import type { CensorLayer, CensorWeight, Frame } from './doc'
import { transformPath } from './path'
import { reframe, translate } from './geometry'
import { layoutText, type Face, type ShapingFont, type TextLayout } from './text'
import { mmToPt, ptToMm } from './units'

// TOP SECRET stripes. The type is a typewriter face sized so its capitals
// fill the stripe, less a thin gap above and below; it is laid out on one
// line and cut off at the stripe's ends.

export const CENSOR_FAMILY = 'Courier Prime'

export const CENSOR_DEFAULTS: Pick<CensorLayer, 'text' | 'weight' | 'insetPt' | 'tracking' | 'align' | 'uppercase' | 'fill' | 'color'> = {
  text: 'TOP SECRET',
  weight: 'medium',
  insetPt: 2,
  tracking: 0,
  align: 'center',
  // Words show as typed; All caps is there when wanted.
  uppercase: false,
  fill: '#0d0d0c',
  color: '#edeef0',
}

/** The font file each weight uses: Medium is the Regular, thickened. */
export const censorFontWeight = (w: CensorWeight) => (w === 'bold' ? 700 : 400)

/** Medium's extra stroke, as a fraction of the em (synthetic bold uses 0.032). */
export const MEDIUM_EMBOLDEN = 0.014

export const censorFace = (font: ShapingFont, w: CensorWeight): Face => ({
  font,
  slant: 0,
  embolden: w === 'medium' ? MEDIUM_EMBOLDEN : 0,
})

export interface CensorLayout extends TextLayout {
  sizePt: number
  /** Width of the set line, mm. */
  textWidth: number
  /** Space kept between the type and the stripe's ends, mm. */
  pad: number
}

type CensorSpec = Pick<CensorLayer, 'text' | 'w' | 'h' | 'insetPt' | 'tracking' | 'align' | 'uppercase'>

export function layoutCensor(face: Face, l: CensorSpec): CensorLayout {
  const font = face.font
  const capRatio = (font.capHeight ?? font.unitsPerEm * 0.7) / font.unitsPerEm
  const inset = ptToMm(Math.max(0, l.insetPt))
  const cap = Math.max(0.2, l.h - 2 * inset)
  const size = cap / capRatio
  const sizePt = mmToPt(size)
  const pad = Math.max(inset, cap * 0.3)
  const set = layoutText(() => face, {
    text: l.text.replace(/\s*\n\s*/g, ' '),
    sizePt,
    leadingPt: sizePt,
    tracking: l.tracking,
    align: l.align,
    uppercase: l.uppercase,
    w: l.w - 2 * pad,
    wrap: false,
  })
  // layoutText puts the baseline at the font's ascent; move it so the
  // capitals' tops sit `inset` below the stripe's top edge.
  const ascent = (font.ascent / font.unitsPerEm) * size
  const m = translate(pad, inset + cap - ascent)
  return {
    ...set,
    path: transformPath(set.path, m),
    stroke: set.stroke && { ...set.stroke, path: transformPath(set.stroke.path, m) },
    sizePt,
    textWidth: set.lineWidths[0] ?? 0,
    pad,
  }
}

/** Stripe length that just holds the line of type. */
export const fitWidth = (layout: CensorLayout) => layout.textWidth + 2 * layout.pad

/**
 * Set the type to `sizePt` by scaling the whole stripe with it — thickness,
 * gap and length — so it keeps its proportions. The aligned end (or the
 * middle) and the stripe's centre line stay put.
 */
export function scaleCensor(l: Frame & Pick<CensorLayer, 'align' | 'insetPt'>, layout: CensorLayout, sizePt: number): Frame & Pick<CensorLayer, 'insetPt'> {
  const k = sizePt / layout.sizePt
  const w = l.w * k
  const h = l.h * k
  const left = l.align === 'left' ? 0 : l.align === 'right' ? l.w - w : (l.w - w) / 2
  const top = (l.h - h) / 2
  return { ...reframe(l, left, top, left + w, top + h), insetPt: l.insetPt * k }
}
