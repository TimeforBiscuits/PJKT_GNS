import fs from 'node:fs'
import path from 'node:path'
import * as fontkit from 'fontkit'
import { describe, expect, it } from 'vitest'
import { normalizeSpans, runsOf, spansFromFlags } from '../model/richtext'
import { layoutText, type ShapingFont } from '../model/text'
import { EMBOLDEN, SLANT, facesFor, fileKey, variantFor, type FontFile } from './variants'

const dir = path.resolve(__dirname, '../../public/fonts')
const get = (f: FontFile) => fontkit.create(fs.readFileSync(path.join(dir, `${fileKey(f)}.woff2`))) as unknown as ShapingFont

describe('bold and italic variants', () => {
  it('sets bold in the next real weight up', () => {
    expect(variantFor('Inter Tight', 400, true, false)).toMatchObject({ weight: 700, embolden: 0 })
    expect(variantFor('Inter Tight', 700, true, false)).toMatchObject({ weight: 900, embolden: 0 })
  })

  it('thickens outlines when there is nothing heavier', () => {
    expect(variantFor('Inter Tight', 900, true, false)).toMatchObject({ weight: 900, embolden: EMBOLDEN })
    expect(variantFor('Bebas Neue', 400, true, false)).toMatchObject({ embolden: EMBOLDEN })
  })

  it('uses a true italic where the family has one, and slants otherwise', () => {
    expect(variantFor('Inter Tight', 800, false, true)).toMatchObject({ weight: 800, italic: true, slant: 0 })
    expect(variantFor('Bebas Neue', 400, false, true)).toMatchObject({ italic: false, slant: SLANT })
  })

  it('every variant points at a font file that exists', () => {
    for (const fam of ['Inter Tight', 'Archivo', 'Bebas Neue', 'Space Grotesk', 'Bodoni Moda'])
      for (const b of [false, true])
        for (const i of [false, true]) {
          const v = variantFor(fam, 400, b, i)
          expect(fs.existsSync(path.join(dir, `${fileKey(v)}.woff2`))).toBe(true)
        }
  })
})

describe('styled runs', () => {
  it('merges and tidies spans', () => {
    expect(normalizeSpans(10, [{ start: 0, end: 3, bold: true }, { start: 3, end: 5, bold: true }, { start: 8, end: 20, italic: true }])).toEqual([
      { start: 0, end: 5, bold: true },
      { start: 8, end: 10, italic: true },
    ])
    expect(spansFromFlags([0, 1, 1, 0], [0, 0, 1, 1])).toEqual([
      { start: 1, end: 2, bold: true },
      { start: 2, end: 3, bold: true, italic: true },
      { start: 3, end: 4, italic: true },
    ])
    expect(runsOf(4, [{ start: 1, end: 3, bold: true }]).map((r) => [r.start, r.end, r.bold])).toEqual([
      [0, 1, false],
      [1, 3, true],
      [3, 4, false],
    ])
  })

  const spec = { text: 'GANS NOTE', sizePt: 48, leadingPt: 48, tracking: 0, align: 'left' as const, uppercase: false, w: 500 }
  const t = { family: 'Inter Tight', weight: 400, text: spec.text }

  it('sets a bold word wider, in the heavier cut', () => {
    const plain = layoutText(facesFor({ ...t, spans: [] }, get)!, spec)
    const spans = [{ start: 0, end: 4, bold: true }]
    const bold = layoutText(facesFor({ ...t, spans }, get)!, { ...spec, spans })
    expect(bold.lineWidths[0]).toBeGreaterThan(plain.lineWidths[0])
    expect(bold.stroke).toBeNull()
  })

  it('slants a synthetic italic and thickens a synthetic bold', () => {
    const tt = { family: 'Bebas Neue', weight: 400, text: 'GANS' }
    const spans = [{ start: 0, end: 4, italic: true, bold: true }]
    const plain = layoutText(facesFor({ ...tt, spans: [] }, get)!, { ...spec, text: 'GANS' })
    const styled = layoutText(facesFor({ ...tt, spans }, get)!, { ...spec, text: 'GANS', spans })
    const maxX = (p: typeof plain.path) => Math.max(...p.flatMap((c) => (c[0] === 'Z' ? [] : [c[c.length - 2] as number])))
    // the tops of the letters lean right
    expect(maxX(styled.path)).toBeGreaterThan(maxX(plain.path) + 1)
    expect(styled.stroke?.path.length).toBeGreaterThan(0)
  })
})
