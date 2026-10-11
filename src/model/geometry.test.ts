import { describe, expect, it } from 'vitest'
import { BLEED_MM, FORMATS, bleedSize, foldX, panelSize, safeRects } from './formats'
import { PRINTERS, coverToSheet, layoutSheet, type Mark, type Placement } from './imposition'
import { A4, mmToPt, ptToMm, type Rect } from './units'

const EPS = 1e-9

const inside = (outer: Rect, x: number, y: number) =>
  x >= outer.x - EPS && x <= outer.x + outer.w + EPS && y >= outer.y - EPS && y <= outer.y + outer.h + EPS

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS

const markRect = (m: Mark): Rect => ({
  x: Math.min(m.x1, m.x2),
  y: Math.min(m.y1, m.y2),
  w: Math.abs(m.x2 - m.x1),
  h: Math.abs(m.y2 - m.y1),
})

describe('units', () => {
  it('converts A4 to the exact PDF point size', () => {
    expect(mmToPt(A4.w)).toBeCloseTo(595.2756, 4)
    expect(mmToPt(A4.h)).toBeCloseTo(841.8898, 4)
    expect(ptToMm(mmToPt(123.45))).toBeCloseTo(123.45, 10)
  })
})

describe('formats', () => {
  it('notebook folds to two 90 × 140 panels', () => {
    const f = FORMATS.notebook
    expect(f.trim).toEqual({ w: 180, h: 140 })
    expect(foldX(f)).toBe(90)
    expect(panelSize(f)).toEqual({ w: 90, h: 140 })
    expect(bleedSize(f)).toEqual({ w: 184, h: 144 })
  })

  it('square folds to two 140 × 140 panels', () => {
    const f = FORMATS.square
    expect(foldX(f)).toBe(140)
    expect(panelSize(f)).toEqual({ w: 140, h: 140 })
    expect(bleedSize(f)).toEqual({ w: 284, h: 144 })
  })

  it('keeps safe areas clear of trim and fold', () => {
    const s = safeRects(FORMATS.notebook)
    expect(s.back).toEqual({ x: 3, y: 3, w: 84, h: 134 })
    expect(s.front).toEqual({ x: 93, y: 3, w: 84, h: 134 })
  })
})

describe('imposition on a Canon PIXMA', () => {
  const printer = PRINTERS.pixma

  it('fits two notebooks per A4, stacked, unrotated, with full bleed printable', () => {
    const l = layoutSheet(FORMATS.notebook, { printer })
    expect(l.placements).toHaveLength(2)
    const [a, b] = l.placements
    expect(a.rotation).toBe(0)
    expect(a.trim.w).toBe(180)
    expect(a.trim.h).toBe(140)
    // centred left to right
    expect(a.trim.x).toBeCloseTo(15, 9)
    // stacked with one bleed width each between the trims
    expect(b.trim.x).toBeCloseTo(a.trim.x, 9)
    expect(b.trim.y - (a.trim.y + a.trim.h)).toBeCloseTo(2 * BLEED_MM, 9)
    expect(l.bleedClipped).toBe(false)
  })

  it('fits one square per A4, turned a quarter, with full bleed printable', () => {
    const l = layoutSheet(FORMATS.square, { printer })
    expect(l.placements).toHaveLength(1)
    const [p] = l.placements
    expect(p.rotation).toBe(90)
    expect(p.trim.w).toBe(140)
    expect(p.trim.h).toBe(280)
    expect(p.trim.x).toBeCloseTo(35, 9)
    expect(l.bleedClipped).toBe(false)
  })

  it('maps the cover corners onto the rotated placement', () => {
    const [p] = layoutSheet(FORMATS.square, { printer }).placements
    const tl = coverToSheet(p, 0, 0)
    const br = coverToSheet(p, 280, 140)
    expect(tl).toEqual({ x: p.trim.x + p.trim.w, y: p.trim.y })
    expect(br.x).toBeCloseTo(p.trim.x, 9)
    expect(br.y).toBeCloseTo(p.trim.y + p.trim.h, 9)
  })
})

describe.each(Object.values(PRINTERS))('imposition invariants — $name', (printer) => {
  describe.each(Object.values(FORMATS))('$name', (format) => {
    const l = layoutSheet(format, { printer })

    it('places at least one cover with every trim on the printable area', () => {
      expect(l.placements.length).toBeGreaterThan(0)
      for (const p of l.placements) {
        expect(inside(l.printable, p.trim.x, p.trim.y)).toBe(true)
        expect(inside(l.printable, p.trim.x + p.trim.w, p.trim.y + p.trim.h)).toBe(true)
      }
    })

    it('never overlaps two covers’ bleed', () => {
      const ps: Placement[] = l.placements
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) expect(overlaps(ps[i].bleed, ps[j].bleed)).toBe(false)
    })

    it('puts every mark where it prints and where it is trimmed away', () => {
      expect(l.marks.length).toBeGreaterThan(0)
      for (const m of l.marks) {
        const r = markRect(m)
        expect(inside(l.printable, r.x, r.y)).toBe(true)
        expect(inside(l.printable, r.x + r.w, r.y + r.h)).toBe(true)
        for (const p of l.placements) {
          // no mark may ever reach into a finished cover
          expect(overlaps(r, p.trim)).toBe(false)
          if (!m.inBleed) expect(overlaps(r, p.bleed)).toBe(false)
        }
      }
    })

    it('marks every cut line and the fold', () => {
      const crop = l.marks.filter((m) => m.kind === 'crop')
      const fold = l.marks.filter((m) => m.kind === 'fold')
      for (const p of l.placements) {
        const t = p.trim
        for (const x of [t.x, t.x + t.w]) expect(crop.some((m) => m.x1 === x && m.x2 === x)).toBe(true)
        for (const y of [t.y, t.y + t.h]) expect(crop.some((m) => m.y1 === y && m.y2 === y)).toBe(true)
      }
      expect(fold.length).toBeGreaterThan(0)
    })
  })
})
