import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as fontkit from 'fontkit'
import { PDFDocument, PDFName } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import catalog from '../fonts/catalog.json'
import { composeSheets } from '../model/compose'
import { newSheet } from '../model/sheets'
import { newCover, uid, type Cover, type ShapeLayer, type TextLayer } from '../model/doc'
import { PRINTERS } from '../model/imposition'
import type { ShapingFont } from '../model/text'
import { writeSheetsPdf, writeTestPagePdf, type WriterDeps } from './writer'

const fontsDir = path.resolve(__dirname, '../../public/fonts')
const fonts = new Map<string, ShapingFont>()
const deps: WriterDeps = {
  font: (family, weight, italic = false) => {
    const e = catalog.find((f) => f.family === family)!
    const list = italic ? e.italics : e.weights
    const w = list.reduce((b, x) => (Math.abs(x - weight) < Math.abs(b - weight) ? x : b))
    const file = `${e.id}-${w}${italic ? 'i' : ''}.woff2`
    if (!fonts.has(file)) fonts.set(file, fontkit.create(fs.readFileSync(path.join(fontsDir, file))) as unknown as ShapingFont)
    return fonts.get(file)!
  },
  image: async () => null,
}

const block = (x: number, y: number, w: number, h: number, fill = '#000000'): ShapeLayer => ({
  id: uid('ly'),
  kind: 'shape',
  name: 'block',
  hidden: false,
  locked: false,
  opacity: 1,
  x,
  y,
  w,
  h,
  rotation: 0,
  shape: 'rect',
  sides: 4,
  radius: 0,
  fill,
  stroke: null,
  strokeWidthPt: 0,
  strokeAlign: 'inside',
  cap: 'butt',
})

const words: TextLayer = {
  id: uid('ly'),
  kind: 'text',
  name: 'Title',
  hidden: false,
  locked: false,
  opacity: 1,
  x: 100,
  y: 20,
  w: 70,
  h: 20,
  rotation: 0,
  text: 'GNS',
  family: 'Archivo',
  weight: 900,
  sizePt: 60,
  leadingPt: 60,
  tracking: 0,
  align: 'left',
  color: '#ff4f00',
  uppercase: false,
  spans: [],
}

/** A notebook whose trim is solid black — easy to measure once printed. */
const blackNotebook = (): Cover => ({ ...newCover('notebook', 1), layers: [block(0, 0, 180, 140), words] })

async function build(cover: Cover, copies: number, cut = false) {
  const sheets = composeSheets({ covers: [cover], sheets: [{ ...newSheet('notebook', cover.id), copies }] }, PRINTERS.pixma)
  const bytes = await writeSheetsPdf(sheets, deps, { marks: { crop: true, fold: true, cut }, slug: () => 'TEST SLUG' })
  return { bytes, sheets }
}

const hasPoppler = (() => {
  try {
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

/** Rasterise page 1 at 254 dpi — exactly 10 pixels per millimetre — as greyscale. */
function render(bytes: Uint8Array) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pjkt-pdf-'))
  fs.writeFileSync(path.join(dir, 'a.pdf'), bytes)
  execFileSync('pdftoppm', ['-r', '254', '-gray', '-f', '1', '-l', '1', path.join(dir, 'a.pdf'), path.join(dir, 'p')])
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.pgm'))!
  const buf = fs.readFileSync(path.join(dir, file))
  // P5 header: magic, width height, maxval, each followed by whitespace
  const head = buf.toString('latin1', 0, 64).split(/\s+/)
  const [w, h] = [Number(head[1]), Number(head[2])]
  const offset = buf.length - w * h
  fs.rmSync(dir, { recursive: true, force: true })
  return { w, h, at: (x: number, y: number) => buf[offset + y * w + x] }
}

describe('PDF output', () => {
  it('writes exact A4 pages that ask to be printed at actual size', async () => {
    const { bytes, sheets } = await build(blackNotebook(), 3)
    expect(sheets).toHaveLength(1)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(3)
    for (const p of doc.getPages()) {
      const { width, height } = p.getSize()
      expect(width).toBeCloseTo(595.2756, 3)
      expect(height).toBeCloseTo(841.8898, 3)
    }
    const prefs = doc.catalog.lookup(PDFName.of('ViewerPreferences'))
    expect(String(prefs)).toContain('/PrintScaling /None')
  })

  it.skipIf(!hasPoppler)('prints the trim exactly 180 × 140 mm where the layout puts it', async () => {
    const { bytes, sheets } = await build(blackNotebook(), 2)
    const img = render(bytes)
    // 210 × 297 mm at 10 px/mm (the rasteriser rounds partial pixels up)
    expect(Math.abs(img.w - 2100)).toBeLessThanOrEqual(1)
    expect(Math.abs(img.h - 2970)).toBeLessThanOrEqual(1)
    const trim = sheets[0].layout.placements[0].trim // 15, 5.5 on the Pixma
    const dark = (v: number) => v < 128

    // Scan across the middle of the top cover, away from the text.
    const row = Math.round((trim.y + 100) * 10)
    let left = -1
    let right = -1
    for (let x = 0; x < img.w; x++) {
      if (!dark(img.at(x, row))) continue
      if (left < 0) left = x
      right = x
    }
    expect(left).toBeGreaterThanOrEqual(trim.x * 10 - 1)
    expect(left).toBeLessThanOrEqual(trim.x * 10 + 1)
    expect(right - left + 1).toBeGreaterThanOrEqual(1799)
    expect(right - left + 1).toBeLessThanOrEqual(1801)

    // And down through it, between the in-bleed marks.
    const col = Math.round((trim.x + 40) * 10)
    let top = -1
    let bottom = -1
    for (let y = 0; y < Math.round((trim.y + trim.h + 2) * 10); y++) {
      if (!dark(img.at(col, y))) continue
      if (top < 0) top = y
      bottom = y
    }
    expect(top).toBeGreaterThanOrEqual(trim.y * 10 - 1)
    expect(top).toBeLessThanOrEqual(trim.y * 10 + 1)
    expect(bottom - top + 1).toBeGreaterThanOrEqual(1399)
    expect(bottom - top + 1).toBeLessThanOrEqual(1401)

    // Text was set: the title area is not plain black.
    let lit = 0
    for (let y = 230; y < 420; y++) for (let x = 1150; x < 1600; x++) if (img.at(x, y) > 60) lit++
    expect(lit).toBeGreaterThan(1000)
  })

  it.skipIf(!hasPoppler)('centres the dashed cut lines exactly on the trim', async () => {
    const { bytes, sheets } = await build(blackNotebook(), 1, true)
    const img = render(bytes)
    const trim = sheets[0].layout.placements[0].trim
    // In the top margin, the vertical cut line's first (black) dash sits on x = trim.x.
    const darkCols: number[] = []
    for (let x = 0; x < 400; x++) if (img.at(x, 10) < 128) darkCols.push(x)
    expect(darkCols.length).toBeGreaterThan(0)
    const mid = (Math.min(...darkCols) + Math.max(...darkCols) + 1) / 2
    expect(Math.abs(mid - trim.x * 10)).toBeLessThanOrEqual(1)
    // In the left margin, the top cut line sits on y = trim.y.
    const darkRows: number[] = []
    for (let y = 0; y < 200; y++) if (img.at(10, y) < 128) darkRows.push(y)
    const midY = (Math.min(...darkRows) + Math.max(...darkRows) + 1) / 2
    expect(Math.abs(midY - trim.y * 10)).toBeLessThanOrEqual(1)
  })

  it.skipIf(!hasPoppler)('draws the test page’s 100 mm square at true size', async () => {
    const img = render(await writeTestPagePdf(deps))
    // The square spans x 55–155 mm; scan its middle row for its two sides.
    const row = 1300
    const hits: number[] = []
    for (let x = 400; x < 1700; x++) if (img.at(x, row) < 128) hits.push(x)
    expect(Math.min(...hits)).toBeGreaterThanOrEqual(549)
    expect(Math.max(...hits)).toBeLessThanOrEqual(1551)
    expect(Math.max(...hits) - Math.min(...hits)).toBeGreaterThanOrEqual(999)
  })
})
