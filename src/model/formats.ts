import type { Rect, Size } from './units'

// A cover is printed flat and folded in half along the x axis: the left
// panel becomes the back cover, the right panel the front cover.

export type FormatId = 'notebook' | 'square'

export interface CoverFormat {
  id: FormatId
  name: string
  /** Flat trimmed size, before folding. */
  trim: Size
}

export const FORMATS: Record<FormatId, CoverFormat> = {
  notebook: { id: 'notebook', name: 'Notebook', trim: { w: 180, h: 140 } },
  square: { id: 'square', name: 'Square', trim: { w: 280, h: 140 } },
}

export const FORMAT_IDS: FormatId[] = ['notebook', 'square']

/** Artwork extends this far past the trim so hand-cutting leaves no white edge. */
export const BLEED_MM = 2

/** Keep text and important detail this far inside every trim edge and the fold. */
export const SAFE_MM = 3

export const foldX = (f: CoverFormat): number => f.trim.w / 2

export const panelSize = (f: CoverFormat): Size => ({ w: f.trim.w / 2, h: f.trim.h })

export const bleedSize = (f: CoverFormat, bleed = BLEED_MM): Size => ({
  w: f.trim.w + 2 * bleed,
  h: f.trim.h + 2 * bleed,
})

/** Bleed box in cover coordinates (origin at the trim's top-left corner). */
export const bleedRect = (f: CoverFormat, bleed = BLEED_MM): Rect => ({
  x: -bleed,
  y: -bleed,
  w: f.trim.w + 2 * bleed,
  h: f.trim.h + 2 * bleed,
})

export type PanelId = 'back' | 'front'

/** Safe areas, one per panel, in cover coordinates. */
export const safeRects = (f: CoverFormat, safe = SAFE_MM): Record<PanelId, Rect> => {
  const p = panelSize(f)
  return {
    back: { x: safe, y: safe, w: p.w - 2 * safe, h: p.h - 2 * safe },
    front: { x: p.w + safe, y: safe, w: p.w - 2 * safe, h: p.h - 2 * safe },
  }
}
