import { describe, expect, it } from 'vitest'
import { composeSheets } from './compose'
import { newCover, type Project } from './doc'
import { dropCover, migrateProject, newSheet, pageCount, placeCover, refileCover } from './sheets'
import { apply, frameMatrix, invert, reframe, type Pt } from './geometry'
import { PRINTERS } from './imposition'
import { polygonPoints, rectPath, toSvgD } from './path'

const close = (a: Pt, b: Pt) => {
  expect(a.x).toBeCloseTo(b.x, 9)
  expect(a.y).toBeCloseTo(b.y, 9)
}

describe('frames', () => {
  const f = { x: 10, y: 20, w: 40, h: 30, rotation: 33 }

  it('maps local corners onto the page and back', () => {
    const m = frameMatrix(f)
    const p = { x: 7, y: 11 }
    close(apply(invert(m), apply(m, p)), p)
  })

  it('rotates about the frame centre', () => {
    close(apply(frameMatrix(f), { x: 20, y: 15 }), { x: 30, y: 35 })
  })

  it('keeps the opposite corner fixed when a rotated frame is resized', () => {
    const before = apply(frameMatrix(f), { x: f.w, y: f.h })
    // drag the top-left handle 5 mm in and 4 mm down, in the frame's own axes
    const g = reframe(f, 5, 4, f.w, f.h)
    expect(g.w).toBe(35)
    expect(g.h).toBe(26)
    close(apply(frameMatrix(g), { x: g.w, y: g.h }), before)
  })
})

describe('paths', () => {
  it('writes compact SVG path data', () => {
    expect(toSvgD(rectPath(0, 0, 10, 5))).toBe('M0 0L10 0L10 5L0 5Z')
  })

  it('stretches polygons to fill their frame exactly', () => {
    for (const n of [3, 5, 6, 8]) {
      const pts = polygonPoints(40, 20, n)
      expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(0, 9)
      expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(40, 9)
      expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(0, 9)
      expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(20, 9)
    }
  })
})

describe('sheets', () => {
  it('prints two different notebooks on one page', () => {
    const a = newCover('notebook', 1)
    const b = newCover('notebook', 2)
    const sq = newCover('square', 3)
    const project: Project = {
      covers: [a, b, sq],
      sheets: [
        { ...newSheet('notebook'), slots: [a.id, b.id], copies: 2 },
        { ...newSheet('square'), slots: [sq.id], copies: 1 },
        { ...newSheet('notebook'), slots: [null, null], copies: 3 },
      ],
    }
    const sheets = composeSheets(project, PRINTERS.pixma)
    expect(sheets.map((s) => [s.formatId, s.covers.map((c) => c?.id ?? null), s.spec.copies])).toEqual([
      ['notebook', [a.id, b.id], 2],
      ['square', [sq.id], 1],
    ])
    expect(pageCount(project)).toBe(3)
  })

  it('keeps a blank slot blank and prints no marks for it', () => {
    const a = newCover('notebook', 1)
    const [sheet] = composeSheets({ covers: [a], sheets: [{ ...newSheet('notebook'), slots: [null, a.id] }] }, PRINTERS.pixma)
    expect(sheet.covers[0]).toBeNull()
    expect(sheet.layout.marks.every((m) => m.slot === 1)).toBe(true)
  })

  it('never prints marks on a cover’s bleed', () => {
    const a = newCover('notebook', 1)
    const [sheet] = composeSheets({ covers: [a], sheets: [newSheet('notebook', a.id)] }, PRINTERS.pixma)
    expect(sheet.layout.marks.some((m) => m.inBleed)).toBe(false)
  })

  it('runs dashed cut lines along every trim edge, never across a cover', () => {
    const a = newCover('notebook', 1)
    const [sheet] = composeSheets({ covers: [a], sheets: [newSheet('notebook', a.id)] }, PRINTERS.pixma)
    const [top, bottom] = sheet.layout.placements
    const xs = new Set(sheet.cuts.filter((c) => c.x1 === c.x2).map((c) => c.x1))
    const ys = new Set(sheet.cuts.filter((c) => c.y1 === c.y2).map((c) => c.y1))
    expect([...xs].sort((p, q) => p - q)).toEqual([top.trim.x, top.trim.x + top.trim.w])
    expect([...ys].sort((p, q) => p - q)).toEqual([top.trim.y, top.trim.y + 140, bottom.trim.y, bottom.trim.y + 140])
    // horizontal cuts span the sheet edge to edge
    for (const c of sheet.cuts.filter((c) => c.y1 === c.y2)) expect([c.x1, c.x2]).toEqual([0, 210])
  })

  it('follows covers as they come and go', () => {
    const a = newCover('notebook', 1)
    const b = newCover('notebook', 2)
    let sheets = [newSheet('notebook', a.id)]
    sheets[0].slots[1] = null
    sheets = placeCover(sheets, b)
    expect(sheets[0].slots).toEqual([a.id, b.id])
    sheets = dropCover(sheets, a.id)
    expect(sheets[0].slots).toEqual([null, b.id])
    sheets = refileCover(sheets, { ...b, formatId: 'square' })
    expect(sheets).toHaveLength(1)
    expect(sheets[0].formatId).toBe('square')
  })

  it('turns an old copies queue into sheets', () => {
    const a = newCover('notebook', 1)
    const b = newCover('notebook', 2)
    const old = { covers: [a, b], queue: { [a.id]: 2, [b.id]: 1 } } as unknown as Project
    const p = migrateProject(old)
    expect(p.sheets.map((s) => s.slots)).toEqual([
      [a.id, a.id],
      [b.id, null],
    ])
  })
})
