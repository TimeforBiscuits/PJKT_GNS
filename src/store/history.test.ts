import { beforeEach, describe, expect, it } from 'vitest'
import { newCover } from '../model/doc'
import { newSheet } from '../model/sheets'
import { useDoc } from './doc'

const cover = () => useDoc.getState().project.covers[0]

beforeEach(() => {
  const c = newCover('notebook', 1)
  useDoc.getState().loadProject({ covers: [c], sheets: [newSheet('notebook', c.id)] })
})

const block = { kind: 'shape', id: 'a', name: 'block', hidden: false, locked: false, opacity: 1, x: 10, y: 20, w: 30, h: 40, rotation: 0, shape: 'rect', sides: 4, radius: 0, fill: '#000000', stroke: null, strokeWidthPt: 0, strokeAlign: 'inside', cap: 'butt' } as const

describe('undo', () => {
  it('still works when a gesture was never closed', () => {
    const doc = useDoc.getState()
    doc.addLayer({ ...block })
    // a typing session or slider whose end never arrived
    doc.beginGesture()
    doc.updateLayer('a', { x: 50 })
    doc.updateLayer('a', { x: 60 })
    expect(useDoc.getState().pending).not.toBeNull()
    useDoc.getState().undo()
    expect(useDoc.getState().pending).toBeNull()
    expect(cover().layers[0].x).toBe(10)
    useDoc.getState().redo()
    expect(cover().layers[0].x).toBe(60)
    useDoc.getState().undo()
    useDoc.getState().undo()
    expect(cover().layers).toHaveLength(0)
  })

  it('redo with an open change just keeps the change', () => {
    const doc = useDoc.getState()
    doc.addLayer({ ...block })
    doc.undo()
    doc.redo()
    doc.beginGesture()
    doc.updateLayer('a', { y: 99 })
    useDoc.getState().redo()
    expect(useDoc.getState().pending).toBeNull()
    expect(cover().layers[0].y).toBe(99)
    useDoc.getState().undo()
    expect(cover().layers[0].y).toBe(20)
  })
})

describe('paste', () => {
  it('lands on the same spot, nudged 5 mm while that spot is taken', () => {
    const doc = useDoc.getState()
    doc.addLayer({ ...block })
    doc.pasteLayer({ ...block })
    doc.pasteLayer({ ...block })
    const ls = cover().layers
    expect(ls.map((l) => [l.x, l.y])).toEqual([
      [10, 20],
      [15, 25],
      [20, 30],
    ])
    // a full copy with its own id
    expect(new Set(ls.map((l) => l.id)).size).toBe(3)
    expect(ls[2]).toMatchObject({ w: 30, h: 40, fill: '#000000', shape: 'rect' })
    expect(useDoc.getState().selectedId).toBe(ls[2].id)
  })
})
