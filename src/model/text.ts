import type { TextLayer } from './doc'
import type { Path, PathCmd } from './path'
import { ptToMm } from './units'

// Text is set into outlines with a real font engine (fontkit): kerning from
// the font, tracking and leading from the layer. The same outlines are drawn
// on screen and written to the PDF, so what you see is exactly what prints.

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

export type TextSpec = Pick<TextLayer, 'text' | 'sizePt' | 'leadingPt' | 'tracking' | 'align' | 'uppercase' | 'w'>

export interface TextLayout {
  /** Outlines in the text frame's own mm, origin at its top-left. */
  path: Path
  /** Frame height: first ascender to last descender. */
  height: number
  lineWidths: number[]
}

/** Advance width of a line in font units, tracking between letters but not after the last. */
function measure(font: ShapingFont, line: string, track: number) {
  if (!line) return 0
  const run = font.layout(line)
  let w = 0
  for (const p of run.positions) w += p.xAdvance + track
  return w - track
}

/** Break a paragraph into lines no wider than `max` font units; long words overflow on their own line. */
function wrap(font: ShapingFont, para: string, track: number, max: number): string[] {
  const words = para.split(/ +/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || measure(font, next, track) <= max) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
}

export function layoutText(font: ShapingFont, spec: TextSpec): TextLayout {
  const size = ptToMm(spec.sizePt)
  const k = size / font.unitsPerEm
  const track = (spec.tracking / 1000) * font.unitsPerEm
  const leading = ptToMm(spec.leadingPt)
  const maxUnits = spec.w / k
  const text = spec.uppercase ? spec.text.toUpperCase() : spec.text

  const lines = text.split('\n').flatMap((p) => wrap(font, p, track, maxUnits))
  const ascent = font.ascent * k
  const descent = -font.descent * k

  const path: Path = []
  const lineWidths: number[] = []
  lines.forEach((line, i) => {
    const baseline = ascent + i * leading
    const run = line ? font.layout(line) : { glyphs: [], positions: [] }
    let width = 0
    for (const p of run.positions) width += p.xAdvance + track
    width = Math.max(0, width - (run.positions.length ? track : 0))
    const wmm = width * k
    lineWidths.push(wmm)
    const offset = spec.align === 'center' ? (spec.w - wmm) / 2 : spec.align === 'right' ? spec.w - wmm : 0

    let pen = 0
    run.glyphs.forEach((g, gi) => {
      const pos = run.positions[gi]
      const ox = pen + pos.xOffset
      const oy = pos.yOffset
      const X = (x: number) => offset + (ox + x) * k
      const Y = (y: number) => baseline - (oy + y) * k
      let cx = 0
      let cy = 0
      for (const c of g.path.commands) {
        const a = c.args
        switch (c.command) {
          case 'moveTo':
            path.push(['M', X(a[0]), Y(a[1])])
            cx = a[0]
            cy = a[1]
            break
          case 'lineTo':
            path.push(['L', X(a[0]), Y(a[1])])
            cx = a[0]
            cy = a[1]
            break
          case 'quadraticCurveTo': {
            // Raise TrueType quadratics to cubics: PDF only draws cubics.
            const [qx, qy, x, y] = a
            path.push([
              'C',
              X(cx + (2 / 3) * (qx - cx)),
              Y(cy + (2 / 3) * (qy - cy)),
              X(x + (2 / 3) * (qx - x)),
              Y(y + (2 / 3) * (qy - y)),
              X(x),
              Y(y),
            ] as PathCmd)
            cx = x
            cy = y
            break
          }
          case 'bezierCurveTo':
            path.push(['C', X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5])])
            cx = a[4]
            cy = a[5]
            break
          case 'closePath':
            path.push(['Z'])
            break
        }
      }
      pen += pos.xAdvance + track
    })
  })

  return { path, height: ascent + (lines.length - 1) * leading + descent, lineWidths }
}
