import { describe, expect, it } from 'vitest'
import { composeSheets } from './compose'
import { newCover, type Project } from './doc'
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

describe('print queue', () => {
  it('packs notebooks two to a sheet and keeps squares on their own sheets', () => {
    const a = newCover('notebook', 1)
    const b = newCover('notebook', 2)
    const sq = newCover('square', 3)
    const project: Project = { covers: [a, sq, b], queue: { [a.id]: 2, [b.id]: 1, [sq.id]: 2 } }
    const sheets = composeSheets(project, PRINTERS.pixma)
    expect(sheets.map((s) => [s.formatId, s.covers.map((c) => c.id)])).toEqual([
      ['notebook', [a.id, a.id]],
      ['notebook', [b.id]],
      ['square', [sq.id]],
      ['square', [sq.id]],
    ])
    // a half-full sheet still lays its one cover out properly
    expect(sheets[1].layout.placements).toHaveLength(1)
  })

  it('prints nothing for zero copies', () => {
    const a = newCover('notebook', 1)
    expect(composeSheets({ covers: [a], queue: { [a.id]: 0 } }, PRINTERS.pixma)).toEqual([])
  })
})
