import {
  PDFDocument,
  PDFName,
  PrintScaling,
  appendBezierCurve,
  clip,
  clipEvenOdd,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endPath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setDashPattern,
  setFillingRgbColor,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  LineCapStyle,
  LineJoinStyle,
  type PDFImage,
  type PDFOperator,
  type PDFPage,
} from 'pdf-lib'
import type { Sheet } from '../model/compose'
import { CENSOR_FAMILY, censorFace, censorFontWeight, layoutCensor } from '../model/censor'
import type { CensorLayer, Cover, ImageLayer, Layer, ShapeLayer, TextLayer } from '../model/doc'
import { bleedFrame, hasEffects } from '../model/doc'
import { fxKey } from '../effects/key'
import { frameMatrix, mul, rotate, translate, type Box, type Mat } from '../model/geometry'
import { CUT_DASH, CUT_GAP, CUT_WIDTH, type CutLine, type Placement } from '../model/imposition'
import { isClosed, rectPath, shapePath, type Path } from '../model/path'
import { layoutText, type ShapingFont } from '../model/text'
import { facesFor } from '../fonts/variants'
import { A4, mmToPt, ptToMm } from '../model/units'

// The PDF writer. Every page is exactly A4 (595.276 × 841.890 pt). The page
// is set up so the drawing unit is one millimetre with y pointing down — the
// same space the editor uses — so geometry passes through untouched.
// Shapes and text are vectors; pictures are embedded at no more than the
// chosen resolution and never upsampled.

export interface PlacedImage {
  bytes: Uint8Array
  kind: 'jpg' | 'png'
  /** Where the (cropped, flipped-in) pixels go, in the frame's own mm. */
  region: Box
}

export interface WriterDeps {
  /** A loaded font for the family and weight (upright unless italic). */
  font: (family: string, weight: number, italic?: boolean) => ShapingFont
  /** Pixels for a picture layer, cropped to what shows and resampled. */
  image: (layer: ImageLayer) => Promise<PlacedImage | null>
  /** A layer with print effects, rendered to pixels; without this, effects are left out. */
  effect?: (layer: Layer) => Promise<PlacedImage | null>
}

export interface WriteOptions {
  /** Dashed cut lines around each picture, on the white paper only. */
  cutLines: boolean
}

const K = mmToPt(1)
const PAGE: [number, number] = [mmToPt(A4.w), mmToPt(A4.h)]



const hexRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const cm = (m: Mat) => concatTransformationMatrix(...m)

const pathOps = (p: Path): PDFOperator[] =>
  p.map((c) => {
    switch (c[0]) {
      case 'M':
        return moveTo(c[1], c[2])
      case 'L':
        return lineTo(c[1], c[2])
      case 'C':
        return appendBezierCurve(c[1], c[2], c[3], c[4], c[5], c[6])
      case 'Z':
        return closePath()
    }
  })

const CAPS: Record<ShapeLayer['cap'], LineCapStyle> = {
  butt: LineCapStyle.Butt,
  round: LineCapStyle.Round,
  square: LineCapStyle.Projecting,
}

/** Start an A4 page whose user space is millimetres, origin top-left, y down. */
function mmPage(pdf: PDFDocument): PDFPage {
  const page = pdf.addPage(PAGE)
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(K, 0, 0, -K, 0, PAGE[1]))
  return page
}

const endPage = (page: PDFPage) => page.pushOperators(popGraphicsState())

class PageWriter {
  private gs = new Map<number, PDFName>()
  private xobjects = new Map<PDFImage, PDFName>()

  readonly pdf: PDFDocument
  readonly page: PDFPage
  readonly deps: WriterDeps
  /** Pictures shared across pages: every copy of a cover reuses one embedded image. */
  readonly images: Map<string, Promise<PDFImage | null>>

  constructor(pdf: PDFDocument, page: PDFPage, deps: WriterDeps, images: Map<string, Promise<PDFImage | null>>) {
    this.pdf = pdf
    this.page = page
    this.deps = deps
    this.images = images
  }

  private opacity(a: number): PDFName {
    let name = this.gs.get(a)
    if (!name) {
      name = this.page.node.newExtGState('GS', this.pdf.context.obj({ Type: 'ExtGState', ca: a, CA: a }))
      this.gs.set(a, name)
    }
    return name
  }

  private xobject(img: PDFImage): PDFName {
    let name = this.xobjects.get(img)
    if (!name) {
      name = this.page.node.newXObject('Im', img.ref)
      this.xobjects.set(img, name)
    }
    return name
  }

  async cover(cover: Cover, place: Mat) {
    const b = bleedFrame(cover)
    const ops: PDFOperator[] = [pushGraphicsState(), cm(place)]
    // Nothing escapes the bleed.
    ops.push(...pathOps(rectPath(b.x, b.y, b.w, b.h)), clip(), endPath())
    ops.push(setFillingRgbColor(...hexRgb(cover.background)), ...pathOps(rectPath(b.x, b.y, b.w, b.h)), fill())
    for (const l of cover.layers) if (!l.hidden) ops.push(...(await this.layer(l)))
    ops.push(popGraphicsState())
    this.page.pushOperators(...ops)
  }

  async layer(l: Layer): Promise<PDFOperator[]> {
    const ops: PDFOperator[] = [pushGraphicsState(), cm(frameMatrix(l))]
    if (l.opacity < 1) ops.push(setGraphicsState(this.opacity(Math.round(l.opacity * 1000) / 1000)))
    if (hasEffects(l) && this.deps.effect) {
      ops.push(...(await this.effect(l)), popGraphicsState())
      return ops
    }
    if (l.kind === 'shape') ops.push(...this.shape(l))
    if (l.kind === 'text') ops.push(...this.text(l))
    if (l.kind === 'censor') ops.push(...this.censor(l))
    if (l.kind === 'image') ops.push(...(await this.image(l)))
    ops.push(popGraphicsState())
    return ops
  }

  shape(s: ShapeLayer): PDFOperator[] {
    const p = shapePath(s)
    const closed = isClosed(p)
    const ops: PDFOperator[] = []
    if (s.fill && closed) ops.push(setFillingRgbColor(...hexRgb(s.fill)), ...pathOps(p), fill())
    const sw = ptToMm(s.strokeWidthPt)
    if (!s.stroke || sw <= 0) return ops
    const align = closed ? s.strokeAlign : 'center'
    const pen = [
      setStrokingRgbColor(...hexRgb(s.stroke)),
      setLineCap(CAPS[s.cap]),
      setLineJoin(LineJoinStyle.Miter),
      setLineWidth(align === 'center' ? sw : sw * 2),
    ]
    if (align === 'center') return [...ops, ...pen, ...pathOps(p), stroke()]
    // Inside: clip to the shape and stroke double width. Outside: clip to
    // everything but the shape and do the same.
    const pad = sw * 2 + 1
    const clipOps =
      align === 'inside'
        ? [...pathOps(p), clip(), endPath()]
        : [...pathOps(rectPath(-pad, -pad, s.w + 2 * pad, s.h + 2 * pad)), ...pathOps(p), clipEvenOdd(), endPath()]
    return [...ops, pushGraphicsState(), ...clipOps, ...pen, ...pathOps(p), stroke(), popGraphicsState()]
  }

  text(t: TextLayer): PDFOperator[] {
    const faces = facesFor(t, (f) => this.deps.font(f.entry.family, f.weight, f.italic))!
    const { path, stroke: bold } = layoutText(faces, t)
    if (!path.length) return []
    const ops = [setFillingRgbColor(...hexRgb(t.color)), ...pathOps(path), fill()]
    if (bold) {
      // Synthetic bold: thicken the outlines with a stroke in the same colour.
      ops.push(
        setStrokingRgbColor(...hexRgb(t.color)),
        setLineWidth(bold.width),
        setLineJoin(LineJoinStyle.Round),
        ...pathOps(bold.path),
        stroke(),
      )
    }
    return ops
  }

  /** TOP SECRET: the stripe, then its type clipped to it. */
  censor(c: CensorLayer): PDFOperator[] {
    const bar = rectPath(0, 0, c.w, c.h)
    const ops = [setFillingRgbColor(...hexRgb(c.fill)), ...pathOps(bar), fill()]
    const face = censorFace(this.deps.font(CENSOR_FAMILY, censorFontWeight(c.weight)), c.weight)
    const { path, stroke: thick } = layoutCensor(face, c)
    if (!path.length) return ops
    ops.push(pushGraphicsState(), ...pathOps(bar), clip(), endPath())
    ops.push(setFillingRgbColor(...hexRgb(c.color)), ...pathOps(path), fill())
    if (thick)
      ops.push(
        setStrokingRgbColor(...hexRgb(c.color)),
        setLineWidth(thick.width),
        setLineJoin(LineJoinStyle.Round),
        ...pathOps(thick.path),
        stroke(),
      )
    ops.push(popGraphicsState())
    return ops
  }

  /** A layer with effects: its render, placed over the area it covers. Copies of a cover share one. */
  async effect(l: Layer): Promise<PDFOperator[]> {
    const key = `fx:${fxKey(l)}`
    let p = this.images.get(key)
    if (!p) {
      p = this.deps.effect!(l).then(async (placed) => {
        if (!placed) return null
        const img = placed.kind === 'png' ? await this.pdf.embedPng(placed.bytes) : await this.pdf.embedJpg(placed.bytes)
        regions.set(img, placed.region)
        return img
      })
      this.images.set(key, p)
    }
    const img = await p
    if (!img) return []
    const r = regions.get(img)!
    return [cm([r.w, 0, 0, -r.h, r.x, r.y + r.h]), drawObject(this.xobject(img))]
  }

  async image(l: ImageLayer): Promise<PDFOperator[]> {
    const key = imageKey(l)
    let p = this.images.get(key)
    if (!p) {
      p = this.deps.image(l).then(async (placed) => {
        if (!placed) return null
        const img = placed.kind === 'png' ? await this.pdf.embedPng(placed.bytes) : await this.pdf.embedJpg(placed.bytes)
        regions.set(img, placed.region)
        return img
      })
      this.images.set(key, p)
    }
    const img = await p
    if (!img) return []
    const r = regions.get(img)!
    return [
      ...pathOps(rectPath(0, 0, l.w, l.h)),
      clip(),
      endPath(),
      // Images fill a unit square with y up; map it onto the region, y down.
      cm([r.w, 0, 0, -r.h, r.x, r.y + r.h]),
      drawObject(this.xobject(img)),
    ]
  }

  /** Dashed cut lines. The dash pattern is anchored to the page so segments of one line stay in step. */
  cuts(lines: CutLine[]) {
    if (!lines.length) return
    const period = CUT_DASH + CUT_GAP
    const ops: PDFOperator[] = [pushGraphicsState(), setLineCap(LineCapStyle.Butt), setLineWidth(CUT_WIDTH), setStrokingRgbColor(0, 0, 0)]
    for (const l of lines) {
      const start = l.x1 === l.x2 ? l.y1 : l.x1
      ops.push(setDashPattern([CUT_DASH, CUT_GAP], start % period), moveTo(l.x1, l.y1), lineTo(l.x2, l.y2), stroke())
    }
    ops.push(popGraphicsState())
    this.page.pushOperators(...ops)
  }

  /** Outlined text at a position and angle, in page mm. */
  label(text: string, font: ShapingFont, sizePt: number, x: number, y: number, deg = 0, color = '#000000') {
    const { path } = layoutText(font, { text, sizePt, leadingPt: sizePt * 1.25, tracking: 0, align: 'left', uppercase: false, w: 1000 })
    this.page.pushOperators(
      pushGraphicsState(),
      cm(mul(translate(x, y), rotate(deg))),
      setFillingRgbColor(...hexRgb(color)),
      ...pathOps(path),
      fill(),
      popGraphicsState(),
    )
  }

  line(x1: number, y1: number, x2: number, y2: number, widthPt = 0.3) {
    this.page.pushOperators(
      pushGraphicsState(),
      setStrokingRgbColor(0, 0, 0),
      setLineWidth(ptToMm(widthPt)),
      moveTo(x1, y1),
      lineTo(x2, y2),
      stroke(),
      popGraphicsState(),
    )
  }

  rect(x: number, y: number, w: number, h: number, fillHex?: string, strokePt?: number) {
    const ops: PDFOperator[] = [pushGraphicsState()]
    if (fillHex) ops.push(setFillingRgbColor(...hexRgb(fillHex)), ...pathOps(rectPath(x, y, w, h)), fill())
    if (strokePt) ops.push(setStrokingRgbColor(0, 0, 0), setLineWidth(ptToMm(strokePt)), ...pathOps(rectPath(x, y, w, h)), stroke())
    ops.push(popGraphicsState())
    this.page.pushOperators(...ops)
  }
}

const regions = new WeakMap<PDFImage, Box>()

const imageKey = (l: ImageLayer) =>
  [l.assetId, l.w, l.h, l.content.x, l.content.y, l.content.w, l.content.h, l.flipX, l.flipY].join('|')

/** The page matrix for a cover in a sheet slot. */
export const placementMatrix = (p: Placement): Mat =>
  p.rotation === 0 ? translate(p.trim.x, p.trim.y) : [0, 1, -1, 0, p.trim.x + p.trim.w, p.trim.y]

function newDoc(pdf: PDFDocument, title: string) {
  pdf.setTitle(title)
  pdf.setCreator('PJKT_GNS — Project Gans cover studio')
  pdf.setProducer('PJKT_GNS')
  pdf.setCreationDate(new Date())
  // Ask viewers to print at actual size rather than "fit to page".
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)
}

export async function writeSheetsPdf(sheets: Sheet[], deps: WriterDeps, opts: WriteOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  newDoc(pdf, 'PJKT_GNS covers')
  const images = new Map<string, Promise<PDFImage | null>>()
  for (const sheet of sheets) {
    for (let copy = 0; copy < sheet.spec.copies; copy++) {
      const page = mmPage(pdf)
      const w = new PageWriter(pdf, page, deps, images)
      for (let j = 0; j < sheet.covers.length; j++) {
        const cover = sheet.covers[j]
        if (cover) await w.cover(cover, placementMatrix(sheet.layout.placements[j]))
      }
      if (opts.cutLines) w.cuts(sheet.cuts)
      endPage(page)
    }
  }
  return pdf.save({ useObjectStreams: true })
}

/** A page for checking a printer: a 100 mm square, rulers, and edge gauges that show the no-print margins. */
export async function writeTestPagePdf(deps: WriterDeps): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  newDoc(pdf, 'PJKT_GNS printer test')
  const page = mmPage(pdf)
  const w = new PageWriter(pdf, page, deps, new Map())
  const bold = deps.font('Inter Tight', 800)
  const mono = deps.font('IBM Plex Mono', 400)

  w.label('//PJKT_GNS — PRINTER TEST', bold, 16, 20, 22)
  const notes = [
    'Print this page at 100 % / Actual size, with borders (not borderless), on A4.',
    'The square must measure exactly 100.0 mm on every side; the ruler 150.0 mm.',
    'Edge gauges: the first tick you can see on each edge is that edge’s no-print margin.',
  ]
  notes.forEach((n, i) => w.label(n, mono, 7.5, 20, 34 + i * 4.2))

  // 100 mm square with its size written inside
  w.rect(55, 60, 100, 100, undefined, 0.3)
  w.label('100.0 × 100.0 mm', mono, 9, 82, 112)
  for (let i = 0; i <= 100; i += 10) {
    w.line(55 + i, 60, 55 + i, 62.5)
    w.line(55, 60 + i, 57.5, 60 + i)
  }

  // 150 mm ruler
  const ry = 185
  w.line(30, ry, 180, ry)
  for (let i = 0; i <= 150; i++) {
    const len = i % 10 === 0 ? 5 : i % 5 === 0 ? 3.2 : 1.8
    w.line(30 + i, ry, 30 + i, ry + len, 0.25)
    if (i % 10 === 0) w.label(String(i), mono, 6, 30 + i - (i >= 100 ? 2.2 : i >= 10 ? 1.4 : 0.7), ry + 9)
  }
  w.label('150 mm', mono, 7, 30, ry - 3)

  // Colour and tone patches
  const patches: [string, string][] = [
    ['#111111', 'BLACK'],
    ['#ff4f00', 'SIGNAL'],
    ['#808080', '50% GREY'],
    ['#0038ff', 'BLUE'],
    ['#ffd400', 'YELLOW'],
  ]
  patches.forEach(([c, name], i) => {
    w.rect(30 + i * 30, 210, 24, 16, c)
    w.label(name, mono, 6, 30 + i * 30, 230)
  })

  // Edge gauges: a tick every mm from each edge inward, long ones every 5 mm.
  // The first tick that prints is that edge's no-print margin.
  const cx = A4.w / 2
  const cy = A4.h / 2
  for (let d = 0; d <= 15; d++) {
    const long = d % 5 === 0
    const len = long ? 9 : 4
    const pt = long ? 0.45 : 0.25
    w.line(cx, d, cx + len, d, pt)
    w.line(cx, A4.h - d, cx + len, A4.h - d, pt)
    w.line(d, cy, d, cy + len, pt)
    w.line(A4.w - d, cy, A4.w - d, cy + len, pt)
    if (long && d) {
      w.label(`${d}`, mono, 5, cx + len + 1, d + 0.7)
      w.label(`${d}`, mono, 5, cx + len + 1, A4.h - d + 0.7)
      w.label(`${d}`, mono, 5, d - 0.8, cy + len + 2.4)
      w.label(`${d}`, mono, 5, A4.w - d - 0.8, cy + len + 2.4)
    }
  }
  w.label('MM FROM TOP EDGE', mono, 5, cx - 22, 18)
  w.label('MM FROM BOTTOM EDGE', mono, 5, cx - 24, A4.h - 17)

  endPage(page)
  return pdf.save({ useObjectStreams: true })
}

