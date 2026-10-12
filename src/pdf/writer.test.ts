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
import { CENSOR_DEFAULTS } from '../model/censor'
import { newCover, uid, type CensorLayer, type Cover, type ShapeLayer, type TextLayer } from '../model/doc'
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
  const bytes = await writeSheetsPdf(sheets, deps, { cutLines: cut })
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

  it.skipIf(!hasPoppler)('prints cut lines on white paper, touching each picture’s outer edge and never on it', async () => {
    // A full-bleed mid-grey picture, so any dash landing on it would show.
    const cover: Cover = { ...newCover('notebook', 1), layers: [block(-2, -2, 184, 144, '#808080')] }
    const { bytes, sheets } = await build(cover, 1, true)
    const img = render(bytes)
    const b = sheets[0].layout.placements[0].bleed // 13, 3.5 → 197, 147.5
    // In the top margin the left cut line sits just left of x = 13 mm.
    const darkCols: number[] = []
    for (let x = 0; x < 400; x++) if (img.at(x, 10) < 128) darkCols.push(x)
    expect(darkCols.length).toBeGreaterThan(0)
    expect(Math.max(...darkCols)).toBeLessThanOrEqual(b.x * 10)
    expect(Math.min(...darkCols)).toBeGreaterThanOrEqual(b.x * 10 - 2)
    // In the left margin the top cut line sits just above y = 3.5 mm.
    const darkRows: number[] = []
    for (let y = 0; y < 100; y++) if (img.at(10, y) < 128) darkRows.push(y)
    expect(Math.max(...darkRows)).toBeLessThanOrEqual(b.y * 10)
    expect(Math.min(...darkRows)).toBeGreaterThanOrEqual(b.y * 10 - 2)
    // Not one dark pixel on the picture itself (it's grey, 128).
    const x0 = Math.ceil(b.x * 10) + 1
    const x1 = Math.floor((b.x + b.w) * 10) - 2
    const y0 = Math.ceil(b.y * 10) + 1
    const y1 = Math.floor((b.y + b.h) * 10) - 2
    for (let x = x0; x <= x1; x += 3) {
      expect(img.at(x, y0)).toBeGreaterThan(100)
      expect(img.at(x, y1)).toBeGreaterThan(100)
    }
    for (let y = y0; y <= y1; y += 3) {
      expect(img.at(x0, y)).toBeGreaterThan(100)
      expect(img.at(x1, y)).toBeGreaterThan(100)
    }
  })

  it.skipIf(!hasPoppler)('prints a TOP SECRET stripe with its type inside the gaps', async () => {
    const stripe: CensorLayer = {
      id: uid('ly'),
      kind: 'censor',
      name: 'Top secret',
      hidden: false,
      locked: false,
      opacity: 1,
      x: 20,
      y: 40,
      w: 110,
      h: 10,
      rotation: 0,
      ...CENSOR_DEFAULTS,
    }
    const cover: Cover = { ...newCover('notebook', 1), layers: [stripe] }
    const { bytes, sheets } = await build(cover, 1)
    const img = render(bytes)
    const t = sheets[0].layout.placements[0].trim
    const X = (mm: number) => Math.round((t.x + mm) * 10)
    const Y = (mm: number) => Math.round((t.y + mm) * 10)
    const light = (y: number) => {
      let n = 0
      for (let x = X(21); x < X(129); x++) if (img.at(x, y) > 128) n++
      return n
    }
    // the stripe is dark from end to end
    expect(img.at(X(20.5), Y(45))).toBeLessThan(40)
    expect(img.at(X(129.5), Y(45))).toBeLessThan(40)
    // letters show in the middle, never in the 2 pt gaps above and below
    expect(light(Y(45))).toBeGreaterThan(50)
    expect(light(Y(40.3))).toBe(0)
    expect(light(Y(49.7))).toBe(0)
    // and nothing outside the stripe
    expect(img.at(X(45), Y(38))).toBeGreaterThan(200)
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
