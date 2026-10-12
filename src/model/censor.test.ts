import fs from 'node:fs'
import path from 'node:path'
import * as fontkit from 'fontkit'
import { describe, expect, it } from 'vitest'
import { censorFace, fitWidth, layoutCensor, scaleCensor } from './censor'
import type { Path } from './path'
import type { ShapingFont } from './text'
import { ptToMm } from './units'

const font = (file: string) => fontkit.create(fs.readFileSync(path.resolve(__dirname, '../../public/fonts', file))) as unknown as ShapingFont
const regular = font('courier-prime-400.woff2')

const ys = (p: Path) => p.flatMap((c) => (c[0] === 'Z' ? [] : c.slice(1).filter((_, i) => i % 2 === 1))) as number[]
const xs = (p: Path) => p.flatMap((c) => (c[0] === 'Z' ? [] : c.slice(1).filter((_, i) => i % 2 === 0))) as number[]

const spec = { text: 'top secret', w: 80, h: 10, insetPt: 2, tracking: 0, align: 'center' as const, uppercase: true }

describe('TOP SECRET stripes', () => {
  it('sets the capitals to fill the stripe, less the gap above and below', () => {
    // flat-topped capitals (round ones overshoot the cap height on purpose)
    const l = layoutCensor(censorFace(regular, 'regular'), { ...spec, text: 'HIT THE TEXT' })
    const y = ys(l.path)
    const gap = ptToMm(2)
    expect(Math.min(...y)).toBeCloseTo(gap, 1)
    expect(Math.max(...y)).toBeCloseTo(10 - gap, 1)
  })

  it('grows the type with the stripe', () => {
    const thin = layoutCensor(censorFace(regular, 'medium'), spec)
    const thick = layoutCensor(censorFace(regular, 'medium'), { ...spec, h: 20 })
    expect(thick.sizePt).toBeGreaterThan(thin.sizePt * 2)
    expect(thin.stroke).not.toBeNull() // medium thickens the regular
  })

  it('keeps one line, centred, and fits the stripe to it', () => {
    const l = layoutCensor(censorFace(regular, 'regular'), { ...spec, text: 'a very long line of words that will not fit' })
    const y = ys(l.path)
    expect(Math.max(...y) - Math.min(...y)).toBeLessThan(10) // no second line
    const x = xs(l.path)
    // centred: runs past both ends by about the same amount
    expect(Math.min(...x)).toBeLessThan(0)
    expect(Math.max(...x)).toBeGreaterThan(80)
    expect(Math.abs(Math.min(...x) + (Math.max(...x) - 80))).toBeLessThan(3)
    const w = fitWidth(l)
    const fitted = layoutCensor(censorFace(regular, 'regular'), { ...spec, text: 'a very long line of words that will not fit', w })
    const fx = xs(fitted.path)
    expect(Math.min(...fx)).toBeGreaterThan(0)
    expect(Math.max(...fx)).toBeLessThan(w)
  })

  it('scales the whole stripe with its type size, keeping its proportions', () => {
    const face = censorFace(regular, 'medium')
    const stripe = { ...spec, x: 20, y: 40, rotation: 0, text: 'TOP SECRET', align: 'left' as const }
    const before = layoutCensor(face, stripe)
    const big = { ...stripe, ...scaleCensor(stripe, before, before.sizePt * 2) }
    const after = layoutCensor(face, big)
    expect(after.sizePt).toBeCloseTo(before.sizePt * 2, 6)
    expect(big.h).toBeCloseTo(20, 6)
    expect(big.w).toBeCloseTo(160, 6)
    expect(big.insetPt).toBeCloseTo(4, 6)
    // the words fill the same share of the stripe as before
    expect(fitWidth(after) / big.w).toBeCloseTo(fitWidth(before) / stripe.w, 6)
    // left-aligned: the left end and the centre line stay put
    expect(big.x).toBeCloseTo(20, 6)
    expect(big.y + big.h / 2).toBeCloseTo(45, 6)
    // centred: the middle stays put
    const mid = scaleCensor({ ...stripe, align: 'center' }, before, before.sizePt / 2)
    expect(mid.x + mid.w / 2).toBeCloseTo(60, 6)
    expect(mid.y + mid.h / 2).toBeCloseTo(45, 6)
  })
})
