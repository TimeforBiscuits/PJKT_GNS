import { describe, expect, it } from 'vitest'
import { bendayCoverage, bendayFlat, distress, halftone, type Pixels } from './kernels'

const K = 10 // px per mm
const solid = (w: number, h: number, rgb: [number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4)
  return { data, width: w, height: h }
}
const meanAlpha = (p: Pixels) => {
  let s = 0
  for (let i = 3; i < p.data.length; i += 4) s += p.data[i]
  return s / (p.data.length / 4) / 255
}
const meanLum = (p: Pixels) => {
  let s = 0
  for (let i = 0; i < p.data.length; i += 4) s += (p.data[i] * 0.3 + p.data[i + 1] * 0.59 + p.data[i + 2] * 0.11) / 255
  return s / (p.data.length / 4)
}

describe('Ben-Day dots', () => {
  it('cover the share of the area the strength asks for, in the same colour', () => {
    for (const strength of [30, 60, 90]) {
      const p = solid(400, 400, [220, 30, 40])
      bendayFlat(p, { x0: 0, y0: 0, k: K }, 2, strength)
      expect(meanAlpha(p)).toBeCloseTo(bendayCoverage(strength), 1)
      expect([...p.data.slice(0, 3)]).toEqual([220, 30, 40])
    }
  })

  it('leave the layer alone at zero strength', () => {
    const p = solid(50, 50, [10, 20, 30])
    bendayFlat(p, { x0: 0, y0: 0, k: K }, 2, 0)
    expect(meanAlpha(p)).toBe(1)
  })

  it('sit in the same places whatever the resolution', () => {
    // coverage at a point in mm doesn't depend on pixels per mm
    const lo = solid(100, 100, [0, 0, 0])
    const hi = solid(400, 400, [0, 0, 0])
    bendayFlat(lo, { x0: 0, y0: 0, k: 10 }, 2, 80)
    bendayFlat(hi, { x0: 0, y0: 0, k: 40 }, 2, 80)
    expect(Math.abs(meanAlpha(lo) - meanAlpha(hi))).toBeLessThan(0.02)
  })
})

describe('comic halftone', () => {
  it('keeps a picture’s overall tone', () => {
    const grey = solid(300, 300, [128, 128, 128])
    halftone(grey, { x0: 0, y0: 0, k: K }, 1.6, 100, () => [0.5, 0.5, 0.5])
    expect(Math.abs(meanLum(grey) - 0.5)).toBeLessThan(0.15)
    const white = solid(100, 100, [255, 255, 255])
    halftone(white, { x0: 0, y0: 0, k: K }, 1.6, 100, () => [1, 1, 1])
    expect(meanLum(white)).toBeGreaterThan(0.99)
  })
})

describe('distressed', () => {
  it('wears more with strength, and only ever takes ink away', () => {
    const at = (strength: number, seed = 7) => {
      const p = solid(300, 200, [17, 17, 17])
      distress(p, { x0: 0, y0: 0, k: K }, strength, seed)
      return p
    }
    expect(meanAlpha(at(0))).toBe(1)
    const light = meanAlpha(at(20))
    const heavy = meanAlpha(at(80))
    expect(light).toBeLessThan(1)
    expect(heavy).toBeLessThan(light - 0.1)
    expect(heavy).toBeGreaterThan(0.2)
    // colour untouched
    const p = at(80)
    for (let i = 0; i < p.data.length; i += 4) expect(p.data[i]).toBe(17)
  })

  it('is the same for the same seed and different for another', () => {
    const run = (seed: number) => {
      const p = solid(120, 80, [0, 0, 0])
      distress(p, { x0: 0, y0: 0, k: K }, 60, seed)
      return p.data
    }
    expect(run(42)).toEqual(run(42))
    expect(run(42)).not.toEqual(run(43))
  })

  it('chips and scratches a big shape the same at any resolution', () => {
    // the damage is planned from one fixed-resolution reading of the shape
    const shapeAt = (k: number) => solid(Math.round(80 * k), Math.round(60 * k), [0, 0, 0])
    const shape = { mask: shapeAt(6), grid: { x0: 0, y0: 0, k: 6 } }
    const cells = (k: number) => {
      const p = shapeAt(k)
      distress(p, { x0: 0, y0: 0, k }, 80, 11, shape)
      // mean alpha in 2 mm cells
      const out: number[] = []
      for (let cy = 0; cy < 30; cy++)
        for (let cx = 0; cx < 40; cx++) {
          let sum = 0
          let n = 0
          for (let j = Math.floor(cy * 2 * k); j < (cy + 1) * 2 * k; j++)
            for (let i = Math.floor(cx * 2 * k); i < (cx + 1) * 2 * k; i++) {
              sum += p.data[(j * p.width + i) * 4 + 3]
              n++
            }
          out.push(sum / n / 255)
        }
      return out
    }
    const lo = cells(6)
    const hi = cells(15)
    let diff = 0
    let damaged = 0
    for (let i = 0; i < lo.length; i++) {
      diff += Math.abs(lo[i] - hi[i])
      if (lo[i] < 0.9) damaged++
    }
    expect(damaged).toBeGreaterThan(10) // it is actually damaged
    expect(diff / lo.length).toBeLessThan(0.02) // in the same places
  })

  it('knocks more out of a big shape’s edges than its middle', () => {
    const p = solid(800, 600, [0, 0, 0]) // 80 × 60 mm
    distress(p, { x0: 0, y0: 0, k: K }, 85, 5)
    const band = (inner: boolean) => {
      let sum = 0
      let n = 0
      for (let j = 0; j < 600; j++)
        for (let i = 0; i < 800; i++) {
          const edge = i < 15 || j < 15 || i >= 785 || j >= 585
          if (edge === inner) continue
          sum += p.data[(j * 800 + i) * 4 + 3]
          n++
        }
      return sum / n / 255
    }
    expect(band(false)).toBeLessThan(band(true) - 0.03)
    // and no spray-paint speckle across the middle
    expect(band(true)).toBeGreaterThan(0.93)
  })

  it('leaves untouched pixels that were already clear', () => {
    const p = solid(100, 100, [0, 0, 0])
    for (let i = 3; i < p.data.length; i += 8) p.data[i] = 0
    distress(p, { x0: 0, y0: 0, k: K }, 70, 3)
    for (let i = 3; i < p.data.length; i += 8) expect(p.data[i]).toBe(0)
  })
})
