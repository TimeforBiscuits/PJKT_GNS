import { describe, expect, it } from 'vitest'
import type { ImageLayer } from './doc'
import { clampToFill, pictureScale, pictureShift, scalePicture, shiftPicture } from './picture'

// A 4000 × 3000 photo full-bleed on a Notebook: frame 184 × 144 mm.
const IW = 4000
const IH = 3000
const layer = (patch: Partial<ImageLayer> = {}): ImageLayer => ({
  id: 'l',
  kind: 'image',
  name: 'p',
  hidden: false,
  locked: false,
  opacity: 1,
  x: -2,
  y: -2,
  w: 184,
  h: 144,
  rotation: 0,
  assetId: 'a',
  // filled: 192 × 144, centred
  content: { x: -4, y: 0, w: 192, h: 144 },
  flipX: false,
  flipY: false,
  fillLock: true,
  ...patch,
})

describe('picture placement', () => {
  it('measures scale against fill', () => {
    expect(pictureScale(layer(), IW, IH)).toBeCloseTo(1, 9)
  })

  it('zooms about the frame centre', () => {
    const c = scalePicture(layer(), IW, IH, 2)
    expect(c.w).toBeCloseTo(384, 9)
    expect(c.h).toBeCloseTo(288, 9)
    // centre stays put
    expect(c.x + c.w / 2).toBeCloseTo(92, 9)
    expect(c.y + c.h / 2).toBeCloseTo(72, 9)
  })

  it('never shrinks below fill or opens a gap while locked', () => {
    const c = scalePicture(layer(), IW, IH, 0.5)
    expect(c.w).toBeGreaterThanOrEqual(184 - 1e-9)
    expect(c.h).toBeGreaterThanOrEqual(144 - 1e-9)
    const moved = clampToFill({ x: 30, y: -500, w: 384, h: 288 }, layer())
    expect(moved.x).toBe(0)
    expect(moved.y).toBe(144 - 288)
  })

  it('may leave gaps when unlocked', () => {
    const c = scalePicture(layer({ fillLock: false }), IW, IH, 0.5)
    expect(c.w).toBeCloseTo(96, 9)
  })

  it('shifts relative to centred, clamped to the frame', () => {
    const big = layer({ content: scalePicture(layer(), IW, IH, 2) })
    expect(pictureShift(big).x).toBeCloseTo(0, 9)
    const c = shiftPicture(big, { x: 40, y: -10 })
    expect(pictureShift({ ...big, content: c })).toEqual({ x: 40, y: -10 })
    const far = shiftPicture(big, { x: 500, y: 0 })
    expect(far.x).toBe(0)
  })
})
