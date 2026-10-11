import { BLEED_MM, foldX, type CoverFormat } from './formats'
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

export type MarkKind = 'crop' | 'fold'

export interface Mark {
  x1: number
  y1: number
  x2: number
  y2: number
  kind: MarkKind
  /**
   * True when the mark sits inside the cover's own bleed because the space
   * outside is unprintable or taken by a neighbouring cover. That strip is
   * cut away, so the mark never shows on the finished cover.
   */
  inBleed: boolean
}

export interface SheetLayout {
  sheet: Size
  printable: Rect
  placements: Placement[]
  marks: Mark[]
  /** Some bleed lands in the printer's no-print zone and will come out white. */
  bleedClipped: boolean
}

export interface LayoutOptions {
  printer?: PrinterProfile
  bleed?: number
  /** Cap on covers per sheet; defaults to as many as fit. */
  max?: number
}

/** Distance from the bleed edge to the start of a crop mark. */
export const MARK_OFFSET = 1
export const MARK_LENGTH = 5
/** Shorter than this and a mark is not worth printing outside the bleed. */
const MARK_MIN = 2
/** Gap between an in-bleed mark and the trim line it points at. */
const IN_BLEED_GAP = 0.5

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
  const marks = placements.flatMap((p) => marksFor(p, format, placements, printable))
  return { sheet, printable, placements, marks, bleedClipped }
}

const containsRect = (outer: Rect, inner: Rect, eps = 1e-6): boolean =>
  inner.x >= outer.x - eps &&
  inner.y >= outer.y - eps &&
  inner.x + inner.w <= outer.x + outer.w + eps &&
  inner.y + inner.h <= outer.y + outer.h + eps

/**
 * Marks along the line `axis = at` at both ends of a placement. A vertical
 * line (axis 'x') gets marks above and below; a horizontal one left and right.
 */
function lineMarks(
  p: Placement,
  axis: 'x' | 'y',
  at: number,
  kind: MarkKind,
  others: Placement[],
  printable: Rect,
): Mark[] {
  // Work in "along" (direction of the line) and "across" coordinates.
  const along = axis === 'x' ? 'y' : 'x'
  const size = along === 'y' ? 'h' : 'w'
  const lo = p.bleed[along]
  const hi = p.bleed[along] + p.bleed[size]
  const trimLo = p.trim[along]
  const trimHi = p.trim[along] + p.trim[size]
  const pLo = printable[along]
  const pHi = printable[along] + printable[size]

  // Neighbours whose bleed crosses this line block the space beyond our bleed.
  const crossing = others.filter(
    (o) => o !== p && o.bleed[axis] < at && o.bleed[axis] + o.bleed[axis === 'x' ? 'w' : 'h'] > at,
  )
  const limitLo = Math.max(
    pLo,
    ...crossing.map((o) => o.bleed[along] + o.bleed[size]).filter((e) => e <= lo + 1e-6),
  )
  const limitHi = Math.min(pHi, ...crossing.map((o) => o.bleed[along]).filter((s) => s >= hi - 1e-6))

  const segs: { a: number; b: number; inBleed: boolean }[] = []

  const roomLo = lo - MARK_OFFSET - limitLo
  if (roomLo >= MARK_MIN) {
    segs.push({ a: lo - MARK_OFFSET - Math.min(MARK_LENGTH, roomLo), b: lo - MARK_OFFSET, inBleed: false })
  } else {
    const a = Math.max(lo, pLo)
    const b = trimLo - IN_BLEED_GAP
    if (b - a >= IN_BLEED_GAP) segs.push({ a, b, inBleed: true })
  }

  const roomHi = limitHi - (hi + MARK_OFFSET)
  if (roomHi >= MARK_MIN) {
    segs.push({ a: hi + MARK_OFFSET, b: hi + MARK_OFFSET + Math.min(MARK_LENGTH, roomHi), inBleed: false })
  } else {
    const a = trimHi + IN_BLEED_GAP
    const b = Math.min(hi, pHi)
    if (b - a >= IN_BLEED_GAP) segs.push({ a, b, inBleed: true })
  }

  return segs.map(({ a, b, inBleed }) =>
    axis === 'x'
      ? { x1: at, y1: a, x2: at, y2: b, kind, inBleed }
      : { x1: a, y1: at, x2: b, y2: at, kind, inBleed },
  )
}

function marksFor(p: Placement, format: CoverFormat, all: Placement[], printable: Rect): Mark[] {
  const t = p.trim
  const fold = foldX(format)
  const marks = [
    ...lineMarks(p, 'x', t.x, 'crop', all, printable),
    ...lineMarks(p, 'x', t.x + t.w, 'crop', all, printable),
    ...lineMarks(p, 'y', t.y, 'crop', all, printable),
    ...lineMarks(p, 'y', t.y + t.h, 'crop', all, printable),
  ]
  // The fold runs across the cover's width; after a quarter-turn it runs across the sheet.
  marks.push(
    ...(p.rotation === 0
      ? lineMarks(p, 'x', t.x + fold, 'fold', all, printable)
      : lineMarks(p, 'y', t.y + fold, 'fold', all, printable)),
  )
  return marks
}

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
