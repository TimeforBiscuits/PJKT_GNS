import { describe, expect, it } from 'vitest'
import { newCover, type ImageLayer } from './doc'
import { clampToFill, pictureScale, pictureShift, pictureSize, resizePicture, scalePicture, shiftPicture, sizeToSlider, sliderToSize } from './picture'

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

describe('picture size against the imported size', () => {
  const cover = newCover('notebook', 1)

  it('reads 1 as imported, whatever the frame is cropped to', () => {
    expect(pictureSize(layer(), IW, IH, cover)).toBeCloseTo(1, 9)
    // cropped to the front panel: same picture, same size
    const cropped = layer({ x: 90, w: 92, content: { x: -94, y: 0, w: 192, h: 144 } })
    expect(pictureSize(cropped, IW, IH, cover)).toBeCloseTo(1, 9)
  })

  it('enlarges and keeps the frame filled', () => {
    const r = resizePicture(layer(), IW, IH, cover, 2)
    expect(r.fillLock).toBe(true)
    expect(r.content.w).toBeCloseTo(384, 9)
  })

  it('shrinks below the frame by letting go of Keep frame filled', () => {
    const r = resizePicture(layer(), IW, IH, cover, 0.5)
    expect(r.fillLock).toBe(false)
    expect(r.content.w).toBeCloseTo(96, 9)
    expect(r.content.x + r.content.w / 2).toBeCloseTo(92, 9) // still centred
    // an unlocked picture stays unlocked when enlarged again
    expect(resizePicture({ ...layer(), ...r }, IW, IH, cover, 1.5).fillLock).toBe(false)
  })

  it('maps the slider: as imported in the middle, a quarter to four times at the ends', () => {
    expect(sizeToSlider(1)).toBeCloseTo(0, 9)
    expect(sizeToSlider(0.25)).toBeCloseTo(-100, 9)
    expect(sizeToSlider(4)).toBeCloseTo(100, 9)
    // half and double sit the same distance either side
    expect(sizeToSlider(0.5)).toBeCloseTo(-sizeToSlider(2), 9)
    expect(sizeToSlider(10)).toBe(100)
    for (const t of [-100, -37, 25, 100]) expect(sizeToSlider(sliderToSize(t))).toBeCloseTo(t, 9)
    // near the middle it snaps to exactly as imported
    expect(sliderToSize(1.5)).toBe(1)
    expect(sliderToSize(-1.5)).toBe(1)
  })
})
