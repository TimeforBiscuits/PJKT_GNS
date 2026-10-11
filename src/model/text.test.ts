import fs from 'node:fs'
import path from 'node:path'
import * as fontkit from 'fontkit'
import { describe, expect, it } from 'vitest'
import { layoutText, type ShapingFont, type TextSpec } from './text'
import { ptToMm } from './units'

const load = (file: string) =>
  fontkit.create(fs.readFileSync(path.resolve(__dirname, '../../public/fonts', file))) as unknown as ShapingFont

const font = load('inter-tight-800.woff2')

const spec = (patch: Partial<TextSpec>): TextSpec => ({
  text: 'GANS',
  sizePt: 72,
  leadingPt: 72,
  tracking: 0,
  align: 'left',
  uppercase: false,
  w: 500,
  ...patch,
})

describe('text layout', () => {
  it('applies the font’s own kerning', () => {
    const pair = layoutText(font, spec({ text: 'AV' })).lineWidths[0]
    const apart = layoutText(font, spec({ text: 'A' })).lineWidths[0] + layoutText(font, spec({ text: 'V' })).lineWidths[0]
    expect(pair).toBeLessThan(apart)
  })

  it('adds tracking between letters in thousandths of an em', () => {
    const plain = layoutText(font, spec({})).lineWidths[0]
    const tracked = layoutText(font, spec({ tracking: 100 })).lineWidths[0]
    // three gaps in GANS, each 0.1 em of a 72 pt size
    expect(tracked - plain).toBeCloseTo(3 * 0.1 * ptToMm(72), 6)
  })

  it('sets lines exactly one leading apart', () => {
    const one = layoutText(font, spec({ text: 'A' })).height
    const three = layoutText(font, spec({ text: 'A\nB\nC', leadingPt: 60 })).height
    expect(three - one).toBeCloseTo(2 * ptToMm(60), 6)
  })

  it('wraps to the frame width and aligns within it', () => {
    const l = layoutText(font, spec({ text: 'NOTEBOOK COVER STUDIO', sizePt: 24, w: 60, align: 'right' }))
    expect(l.lineWidths.length).toBeGreaterThan(1)
    for (const w of l.lineWidths) expect(w).toBeLessThanOrEqual(60 + 1e-6)
    // right-aligned: every line's outline ends at the frame's right edge (±the glyph sidebearing)
    const xs = l.path.flatMap((c) => (c[0] === 'Z' ? [] : [c[c.length - 2] as number]))
    expect(Math.max(...xs)).toBeLessThanOrEqual(60 + 0.5)
  })

  it('sets capitals when asked', () => {
    const a = layoutText(font, spec({ text: 'gans', uppercase: true })).lineWidths[0]
    const b = layoutText(font, spec({ text: 'GANS' })).lineWidths[0]
    expect(a).toBeCloseTo(b, 9)
  })

  it('writes only drawable commands', () => {
    const l = layoutText(font, spec({ text: 'Ganso 3' }))
    expect(l.path.length).toBeGreaterThan(10)
    expect(new Set(l.path.map((c) => c[0]))).toEqual(new Set(['M', 'L', 'C', 'Z']))
  })
})
