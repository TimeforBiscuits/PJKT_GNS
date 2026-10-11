// All document geometry is stored in millimetres. PDF space is in points
// (1/72 inch). These are the only conversions the app needs.

export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72

export const mmToPt = (mm: number): number => (mm * PT_PER_INCH) / MM_PER_INCH
export const ptToMm = (pt: number): number => (pt * MM_PER_INCH) / PT_PER_INCH

/** Pixels needed to cover `mm` at a given print resolution. */
export const mmToPx = (mm: number, dpi: number): number => (mm * dpi) / MM_PER_INCH

/** Effective resolution of `px` pixels printed across `mm`. */
export const effectivePpi = (px: number, mm: number): number => (px * MM_PER_INCH) / mm

/** CSS defines 96px per inch; real screens differ, hence calibration. */
export const CSS_PX_PER_MM = 96 / MM_PER_INCH

export interface Size {
  w: number
  h: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const A4: Size = { w: 210, h: 297 }

/** Round to 0.01 mm — finer than any printer can place ink. */
export const roundMm = (mm: number): number => Math.round(mm * 100) / 100
