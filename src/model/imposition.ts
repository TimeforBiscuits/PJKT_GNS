import { BLEED_MM, type CoverFormat } from './formats'
import { A4, type Rect, type Size } from './units'

// Imposition: arranging covers on an A4 sheet for printing.
//
// The PDF page is always portrait A4. Covers that only fit sideways are
// rotated on the page rather than rotating the page, so print dialogs never
// have to guess an orientation (a common source of accidental scaling).

export interface PrinterProfile {
  id: string
  name: string
  /** Strip along each edge of a portrait sheet the printer cannot ink, in mm. Top is the leading edge. */
  margins: { top: number; right: number; bottom: number; left: number }
}

export const PRINTERS: Record<string, PrinterProfile> = {
  pixma: {
    id: 'pixma',
    name: 'Canon PIXMA — bordered',
    margins: { top: 3, right: 3.4, bottom: 5, left: 3.4 },
  },
  generic: {
    id: 'generic',
    name: 'Generic — 5 mm margins',
    margins: { top: 5, right: 5, bottom: 5, left: 5 },
  },
}

export const DEFAULT_PRINTER = PRINTERS.pixma

export interface Placement {
  /** Trimmed cover on the sheet, after rotation, in sheet mm. */
  trim: Rect
  /** Trim plus bleed on the sheet. */
  bleed: Rect
  /** 90 = cover turned a quarter-turn clockwise (its top edge faces right). */
  rotation: 0 | 90
}

export interface SheetLayout {
  sheet: Size
  printable: Rect
  placements: Placement[]
  /** Some bleed lands in the printer's no-print zone and will come out white. */
  bleedClipped: boolean
}

export interface LayoutOptions {
  printer?: PrinterProfile
  bleed?: number
  /** Cap on covers per sheet; defaults to as many as fit. */
  max?: number
}

/** Drop floating-point dust (0.1 µm) so positions read as the round numbers they are. */
const tidy = (mm: number): number => Math.round(mm * 1e4) / 1e4

export const printableRect = (printer: PrinterProfile, sheet: Size = A4): Rect => {
  const m = printer.margins
  return { x: m.left, y: m.top, w: sheet.w - m.left - m.right, h: sheet.h - m.top - m.bottom }
}

/** How many trims of length `len` fit along `space` with `gutter` between neighbours. */
const fitCount = (len: number, gutter: number, space: number): number =>
  len > space ? 0 : Math.floor((space + gutter) / (len + gutter))

/** Offset of a block of size `block` (with optional `pad` each side) centred in [start, start+space]. */
const centre = (start: number, space: number, block: number, pad: number): number =>
  block + 2 * pad <= space ? start + (space - block - 2 * pad) / 2 + pad : start + (space - block) / 2

export function layoutSheet(format: CoverFormat, opts: LayoutOptions = {}): SheetLayout {
  const printer = opts.printer ?? DEFAULT_PRINTER
  const bleed = opts.bleed ?? BLEED_MM
  const sheet = A4
  const printable = printableRect(printer, sheet)
  // Neighbouring covers each keep their own bleed, so trims sit 2 × bleed apart.
  const gutter = 2 * bleed

  let best = { rotation: 0 as 0 | 90, cols: 0, rows: 0 }
  for (const rotation of [0, 90] as const) {
    const tw = rotation ? format.trim.h : format.trim.w
    const th = rotation ? format.trim.w : format.trim.h
    const cols = fitCount(tw, gutter, printable.w)
    const rows = fitCount(th, gutter, printable.h)
    if (cols * rows > best.cols * best.rows) best = { rotation, cols, rows }
  }

  const n = Math.min(best.cols * best.rows, opts.max ?? Infinity)
  const placements: Placement[] = []
  if (n > 0) {
    const tw = best.rotation ? format.trim.h : format.trim.w
    const th = best.rotation ? format.trim.w : format.trim.h
    const cols = Math.min(best.cols, n)
    const rows = Math.ceil(n / cols)
    const blockW = cols * tw + (cols - 1) * gutter
    const blockH = rows * th + (rows - 1) * gutter
    const x0 = centre(printable.x, printable.w, blockW, bleed)
    const y0 = centre(printable.y, printable.h, blockH, bleed)
    for (let i = 0; i < n; i++) {
      const trim = {
        x: tidy(x0 + (i % cols) * (tw + gutter)),
        y: tidy(y0 + Math.floor(i / cols) * (th + gutter)),
        w: tw,
        h: th,
      }
      placements.push({
        trim,
        bleed: { x: trim.x - bleed, y: trim.y - bleed, w: tw + 2 * bleed, h: th + 2 * bleed },
        rotation: best.rotation,
      })
    }
  }

  const bleedClipped = placements.some((p) => !containsRect(printable, p.bleed))
  return { sheet, printable, placements, bleedClipped }
}

const containsRect = (outer: Rect, inner: Rect, eps = 1e-6): boolean =>
  inner.x >= outer.x - eps &&
  inner.y >= outer.y - eps &&
  inner.x + inner.w <= outer.x + outer.w + eps &&
  inner.y + inner.h <= outer.y + outer.h + eps

/** SVG/PDF-style transform taking cover coordinates (mm, trim origin) onto the sheet. */
export const placementTransform = (p: Placement): string =>
  p.rotation === 0
    ? `translate(${p.trim.x} ${p.trim.y})`
    : `translate(${p.trim.x + p.trim.w} ${p.trim.y}) rotate(90)`

/** Map a point in cover coordinates to sheet coordinates. */
export const coverToSheet = (p: Placement, cx: number, cy: number): { x: number; y: number } =>
  p.rotation === 0
    ? { x: p.trim.x + cx, y: p.trim.y + cy }
    : { x: p.trim.x + p.trim.w - cy, y: p.trim.y + cx }

export const coversPerSheet = (format: CoverFormat, printer: PrinterProfile = DEFAULT_PRINTER): number =>
  layoutSheet(format, { printer }).placements.length

/** Printed cut lines: 0.35 pt wide, 2 mm dashes with 1.5 mm gaps. */
export const CUT_WIDTH = (0.35 * 25.4) / 72
export const CUT_DASH = 2
export const CUT_GAP = 1.5

export interface CutLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Dashed cutting guides along the outer edge of every printed picture (its
 * bleed edge) — where the sticker is cut out, keeping its 2 mm bleed for
 * trimming after it's mounted.
 *
 * Each edge runs right across the sheet so a ruler can be laid along it,
 * but is only drawn over white paper: a line running beside a picture sits
 * just outside it (touching, never on it), and where two pictures meet
 * the line only appears in the margins either side.
 */
export function cutLines(layout: SheetLayout, filled: boolean[], width = CUT_WIDTH): CutLine[] {
  const boxes = layout.placements.filter((_, i) => filled[i]).map((p) => p.bleed)
  const { w: W, h: H } = layout.sheet
  const d = 1e-4
  const inside = (x: number, y: number) => boxes.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)
  const lines: CutLine[] = []

  /** One guide at `at` across the sheet; `vertical` lines run down the page. */
  const guide = (at: number, vertical: boolean) => {
    const len = vertical ? H : W
    const stops = [0, len, ...boxes.flatMap((b) => (vertical ? [b.y, b.y + b.h] : [b.x, b.x + b.w]))]
      .filter((v) => v >= 0 && v <= len)
      .sort((a, b) => a - b)
    const segs: [number, number][] = []
    let before = false
    let after = false
    for (let i = 0; i + 1 < stops.length; i++) {
      const [a, b] = [stops[i], stops[i + 1]]
      if (b - a < 1e-6) continue
      const m = (a + b) / 2
      const lo = vertical ? inside(at - d, m) : inside(m, at - d)
      const hi = vertical ? inside(at + d, m) : inside(m, at + d)
      if (lo && hi) continue // between two pictures, or across one: no line
      before ||= lo
      after ||= hi
      const last = segs[segs.length - 1]
      if (last && Math.abs(last[1] - a) < 1e-6) last[1] = b
      else segs.push([a, b])
    }
    // Step off the picture by half the line's width so no ink lands on it.
    const shift = before && !after ? width / 2 : after && !before ? -width / 2 : 0
    const c = at + shift
    for (const [a, b] of segs) lines.push(vertical ? { x1: c, y1: a, x2: c, y2: b } : { x1: a, y1: c, x2: b, y2: c })
  }

  for (const x of new Set(boxes.flatMap((b) => [b.x, b.x + b.w]))) guide(x, true)
  for (const y of new Set(boxes.flatMap((b) => [b.y, b.y + b.h]))) guide(y, false)
  return lines
}
