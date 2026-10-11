import type { TextLayer } from './doc'
import type { Path, PathCmd } from './path'
import { runsOf, type Run } from './richtext'
import { ptToMm } from './units'

// Text is set into outlines with a real font engine (fontkit): kerning from
// the font, tracking and leading from the layer, bold and italic words from
// the layer's spans. The same outlines are drawn on screen and written to the
// PDF, so what you see is exactly what prints.

/** The slice of a fontkit font this module needs. */
export interface ShapingFont {
  unitsPerEm: number
  ascent: number
  descent: number
  layout(text: string): {
    glyphs: { path: { commands: { command: string; args: number[] }[] } }[]
    positions: { xAdvance: number; xOffset: number; yOffset: number }[]
  }
}

/** A font as one style of a layer uses it. */
export interface Face {
  font: ShapingFont
  /** Synthetic italic: horizontal shear per unit of height (0 for a true italic). */
  slant: number
  /** Synthetic bold: outline stroke width as a fraction of the em (0 for a true bold). */
  embolden: number
}

export type FaceFor = (bold: boolean, italic: boolean) => Face

export type TextSpec = Pick<TextLayer, 'text' | 'sizePt' | 'leadingPt' | 'tracking' | 'align' | 'uppercase' | 'w'> &
  Partial<Pick<TextLayer, 'spans'>>

export interface TextLayout {
  /** Filled outlines in the text frame's own mm, origin at its top-left. */
  path: Path
  /** Glyphs to thicken with a stroke (synthetic bold), and that stroke's width in mm. */
  stroke: { path: Path; width: number } | null
  /** Frame height: first ascender to last descender. */
  height: number
  lineWidths: number[]
}

/** Capitals without changing the string's length (so style ranges stay put). */
const caps = (t: string) => [...t].map((c) => (c.toUpperCase().length === c.length ? c.toUpperCase() : c)).join('')

interface Shaped {
  face: Face
  k: number
  glyphs: ReturnType<ShapingFont['layout']>['glyphs']
  positions: ReturnType<ShapingFont['layout']>['positions']
}

export function layoutText(fonts: FaceFor | ShapingFont, spec: TextSpec): TextLayout {
  const faceFor: FaceFor = typeof fonts === 'function' ? fonts : () => ({ font: fonts, slant: 0, embolden: 0 })
  const base = faceFor(false, false).font
  const size = ptToMm(spec.sizePt)
  const track = (spec.tracking / 1000) * size
  const leading = ptToMm(spec.leadingPt)
  const text = spec.uppercase ? caps(spec.text) : spec.text

  const shape = (a: number, b: number): Shaped[] =>
    runsOf(text.length, spec.spans, a, b).map((r: Run) => {
      const face = faceFor(r.bold, r.italic)
      const run = face.font.layout(text.slice(r.start, r.end))
      return { face, k: size / face.font.unitsPerEm, glyphs: run.glyphs, positions: run.positions }
    })

  /** Width of [a, b) in mm: tracking between letters, not after the last. */
  const measure = (a: number, b: number) => {
    let w = 0
    let n = 0
    for (const s of shape(a, b))
      for (const p of s.positions) {
        w += p.xAdvance * s.k + track
        n++
      }
    return n ? w - track : 0
  }

  // Break each paragraph into lines that fit the frame; a word too long for
  // the frame overflows on its own line.
  const lines: [number, number][] = []
  let p0 = 0
  for (const para of text.split('\n')) {
    const p1 = p0 + para.length
    let start = -1
    let end = -1
    const re = /[^ ]+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(para))) {
      const ws = p0 + m.index
      const we = ws + m[0].length
      if (start < 0) [start, end] = [ws, we]
      else if (measure(start, we) <= spec.w) end = we
      else {
        lines.push([start, end])
        ;[start, end] = [ws, we]
      }
    }
    lines.push(start < 0 ? [p0, p0] : [start, end])
    p0 = p1 + 1
  }

  const k0 = size / base.unitsPerEm
  const ascent = base.ascent * k0
  const descent = -base.descent * k0

  const path: Path = []
  const strokePath: Path = []
  let strokeWidth = 0
  const lineWidths: number[] = []

  lines.forEach(([a, b], i) => {
    const baseline = ascent + i * leading
    const width = measure(a, b)
    lineWidths.push(width)
    const offset = spec.align === 'center' ? (spec.w - width) / 2 : spec.align === 'right' ? spec.w - width : 0
    let pen = 0
    for (const s of shape(a, b)) {
      const { k, face } = s
      const out = face.embolden > 0 ? strokePath : null
      if (out) strokeWidth = face.embolden * size
      s.glyphs.forEach((g, gi) => {
        const pos = s.positions[gi]
        const X = (x: number, y: number) => offset + pen + (pos.xOffset + x) * k + face.slant * (pos.yOffset + y) * k
        const Y = (y: number) => baseline - (pos.yOffset + y) * k
        const emit = (c: PathCmd) => {
          path.push(c)
          out?.push(c)
        }
        let cx = 0
        let cy = 0
        for (const c of g.path.commands) {
          const v = c.args
          switch (c.command) {
            case 'moveTo':
              emit(['M', X(v[0], v[1]), Y(v[1])])
              ;[cx, cy] = [v[0], v[1]]
              break
            case 'lineTo':
              emit(['L', X(v[0], v[1]), Y(v[1])])
              ;[cx, cy] = [v[0], v[1]]
              break
            case 'quadraticCurveTo': {
              // Raise TrueType quadratics to cubics: PDF only draws cubics.
              const [qx, qy, x, y] = v
              const c1 = [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)]
              const c2 = [x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y)]
              emit(['C', X(c1[0], c1[1]), Y(c1[1]), X(c2[0], c2[1]), Y(c2[1]), X(x, y), Y(y)])
              ;[cx, cy] = [x, y]
              break
            }
            case 'bezierCurveTo':
              emit(['C', X(v[0], v[1]), Y(v[1]), X(v[2], v[3]), Y(v[3]), X(v[4], v[5]), Y(v[5])])
              ;[cx, cy] = [v[4], v[5]]
              break
            case 'closePath':
              emit(['Z'])
              break
          }
        }
        pen += pos.xAdvance * k + track
      })
    }
  })

  return {
    path,
    stroke: strokePath.length ? { path: strokePath, width: strokeWidth } : null,
    height: ascent + (lines.length - 1) * leading + descent,
    lineWidths,
  }
}
