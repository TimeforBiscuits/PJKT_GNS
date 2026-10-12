import { layoutCensor } from '../model/censor'
import type { CensorLayer, ImageLayer, Layer, ShapeLayer, TextLayer } from '../model/doc'
import type { Box } from '../model/geometry'
import { isClosed, rectPath, shapePath, toSvgD } from '../model/path'
import { layoutText, type Face, type FaceFor } from '../model/text'
import { ptToMm } from '../model/units'
import { bendayFlat, distress, halftone, type Grid, type Pixels, type Shape } from './kernels'

// Draws one layer onto a canvas in its own millimetres, applies its print
// effects, and hands back the pixels with the box they cover. The screen
// preview and the PDF both come from here, at different resolutions.

export interface FxEnv {
  /** Text layers: their fonts. */
  faces?: FaceFor | null
  /** TOP SECRET stripes: their face. */
  censor?: Face | null
  /** Pictures: decoded pixels, EXIF-oriented. */
  picture?: CanvasImageSource | null
}

export interface FxRaster {
  canvas: HTMLCanvasElement
  /** Where the canvas goes, in the layer's frame (mm). */
  box: Box
  /** Every pixel is solid (so it can be stored as a JPEG). */
  opaque: boolean
}

/** The area a layer draws into, in its frame's mm (strokes and type can spill over the frame). */
export function fxBox(l: Layer): Box {
  if (l.kind === 'image' || l.kind === 'censor') return { x: 0, y: 0, w: l.w, h: l.h }
  if (l.kind === 'text') {
    const pad = Math.max(1, ptToMm(l.sizePt) * 0.3)
    return { x: -pad, y: -pad, w: l.w + 2 * pad, h: l.h + 2 * pad }
  }
  const sw = l.stroke ? ptToMm(l.strokeWidthPt) : 0
  const pad = sw * 1.5 + 0.5
  return { x: -pad, y: -pad, w: l.w + 2 * pad, h: l.h + 2 * pad }
}

/** The fill pass (what dots apply to) or the line pass (kept solid on top). */
type Pass = 'fill' | 'line'

function drawShape(ctx: CanvasRenderingContext2D, s: ShapeLayer, pass: Pass) {
  const p = shapePath(s)
  const path = new Path2D(toSvgD(p))
  const closed = isClosed(p)
  if (pass === 'fill') {
    if (s.fill && closed) {
      ctx.fillStyle = s.fill
      ctx.fill(path)
    }
    return
  }
  const sw = ptToMm(s.strokeWidthPt)
  if (!s.stroke || sw <= 0) return
  const align = closed ? s.strokeAlign : 'center'
  ctx.save()
  ctx.strokeStyle = s.stroke
  ctx.lineCap = s.cap
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 10
  ctx.lineWidth = align === 'center' ? sw : sw * 2
  if (align === 'inside') ctx.clip(path)
  if (align === 'outside') {
    const pad = sw * 2 + 1
    const outer = new Path2D(toSvgD(rectPath(-pad, -pad, s.w + 2 * pad, s.h + 2 * pad)))
    outer.addPath(path)
    ctx.clip(outer, 'evenodd')
  }
  ctx.stroke(path)
  ctx.restore()
}

function drawText(ctx: CanvasRenderingContext2D, t: TextLayer, faces: FaceFor) {
  const { path, stroke } = layoutText(faces, t)
  ctx.fillStyle = t.color
  ctx.fill(new Path2D(toSvgD(path)))
  if (stroke) {
    ctx.strokeStyle = t.color
    ctx.lineWidth = stroke.width
    ctx.lineJoin = 'round'
    ctx.stroke(new Path2D(toSvgD(stroke.path)))
  }
}

function drawCensor(ctx: CanvasRenderingContext2D, c: CensorLayer, face: Face, pass: Pass) {
  if (pass === 'fill') {
    ctx.fillStyle = c.fill
    ctx.fillRect(0, 0, c.w, c.h)
    return
  }
  // The words stay crisp over a dotted stripe.
  const { path, stroke } = layoutCensor(face, c)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, c.w, c.h)
  ctx.clip()
  ctx.fillStyle = c.color
  ctx.fill(new Path2D(toSvgD(path)))
  if (stroke) {
    ctx.strokeStyle = c.color
    ctx.lineWidth = stroke.width
    ctx.lineJoin = 'round'
    ctx.stroke(new Path2D(toSvgD(stroke.path)))
  }
  ctx.restore()
}

function drawPicture(ctx: CanvasRenderingContext2D, l: ImageLayer, src: CanvasImageSource) {
  const c = l.content
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, l.w, l.h)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(l.flipX ? 2 * c.x + c.w : 0, l.flipY ? 2 * c.y + c.h : 0)
  ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1)
  ctx.drawImage(src, c.x, c.y, c.w, c.h)
  ctx.restore()
}

function draw(ctx: CanvasRenderingContext2D, l: Layer, env: FxEnv, pass: Pass) {
  if (l.kind === 'shape') drawShape(ctx, l, pass)
  if (l.kind === 'text' && pass === 'fill' && env.faces) drawText(ctx, l, env.faces)
  if (l.kind === 'censor' && env.censor) drawCensor(ctx, l, env.censor, pass)
  if (l.kind === 'image' && pass === 'fill' && env.picture) drawPicture(ctx, l, env.picture)
}

const pixels = (ctx: CanvasRenderingContext2D, w: number, h: number): Pixels & { img: ImageData } => {
  const img = ctx.getImageData(0, 0, w, h)
  return { img, data: img.data, width: w, height: h }
}

/** The picture's colour averaged over about half a dot, for the halftone to read. */
function sampler(src: HTMLCanvasElement, box: Box, cellMm: number) {
  const sw = Math.max(2, Math.ceil(box.w / cellMm))
  const sh = Math.max(2, Math.ceil(box.h / cellMm))
  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  const sctx = small.getContext('2d')!
  sctx.imageSmoothingEnabled = true
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(src, 0, 0, sw, sh)
  const d = sctx.getImageData(0, 0, sw, sh).data
  small.width = small.height = 0
  return (u: number, v: number): [number, number, number] => {
    const fx = ((u - box.x) / box.w) * sw - 0.5
    const fy = ((v - box.y) / box.h) * sh - 0.5
    const x = Math.min(sw - 2, Math.max(0, Math.floor(fx)))
    const y = Math.min(sh - 2, Math.max(0, Math.floor(fy)))
    const tx = Math.min(1, Math.max(0, fx - x))
    const ty = Math.min(1, Math.max(0, fy - y))
    const at = (xx: number, yy: number, c: number) => d[(yy * sw + xx) * 4 + c] / 255
    const lerp = (c: number) => {
      const a = at(x, y, c) + (at(x + 1, y, c) - at(x, y, c)) * tx
      const b = at(x, y + 1, c) + (at(x + 1, y + 1, c) - at(x, y + 1, c)) * tx
      return a + (b - a) * ty
    }
    return [lerp(0), lerp(1), lerp(2)]
  }
}

/**
 * The plain layer at a fixed resolution that depends only on its size, for
 * the damage to be planned from: the preview and the print read the same.
 */
function shapeOf(l: Layer, env: FxEnv, b: Box): Shape {
  const k = Math.min(6, Math.sqrt(1_500_000 / (b.w * b.h)))
  const W = Math.max(1, Math.round(b.w * k))
  const H = Math.max(1, Math.round(b.h * k))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.setTransform(W / b.w, 0, 0, H / b.h, (-b.x * W) / b.w, (-b.y * H) / b.h)
  draw(ctx, l, env, 'fill')
  draw(ctx, l, env, 'line')
  const mask = pixels(ctx, W, H)
  canvas.width = canvas.height = 0
  return { mask, grid: { x0: b.x, y0: b.y, k: (W / b.w + H / b.h) / 2 } }
}

/**
 * Render a layer with its effects at k pixels per mm (lowered if the canvas
 * would pass maxPixels). Returns null if there's nothing to draw yet.
 */
export function renderFx(l: Layer, env: FxEnv, k: number, maxPixels = 16_000_000): FxRaster | null {
  const fx = l.effects
  const b = fxBox(l)
  if (b.w <= 0 || b.h <= 0) return null
  if (b.w * b.h * k * k > maxPixels) k = Math.sqrt(maxPixels / (b.w * b.h))
  // Whole pixels spanning exactly the box, so a picture's render covers its
  // frame edge to edge (and can be stored opaque).
  const W = Math.max(1, Math.round(b.w * k))
  const H = Math.max(1, Math.round(b.h * k))
  const kx = W / b.w
  const ky = H / b.h
  const box = b
  const grid: Grid = { x0: box.x, y0: box.y, k: (kx + ky) / 2 }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Out of memory drawing an effect.')
  ctx.setTransform(kx, 0, 0, ky, -box.x * kx, -box.y * ky)
  draw(ctx, l, env, 'fill')

  if (fx?.benday && fx.benday.strength > 0) {
    if (l.kind === 'image') {
      const sample = sampler(canvas, box, fx.benday.dotMm / 2)
      const px = pixels(ctx, W, H)
      halftone(px, grid, fx.benday.dotMm, fx.benday.strength, sample)
      ctx.putImageData(px.img, 0, 0)
    } else {
      const px = pixels(ctx, W, H)
      bendayFlat(px, grid, fx.benday.dotMm, fx.benday.strength)
      ctx.putImageData(px.img, 0, 0)
    }
  }
  draw(ctx, l, env, 'line')

  let opaque = false
  if (fx?.distress && fx.distress.strength > 0) {
    const px = pixels(ctx, W, H)
    distress(px, grid, fx.distress.strength, fx.distress.seed, shapeOf(l, env, b))
    ctx.putImageData(px.img, 0, 0)
  } else if (l.kind === 'image') {
    const d = ctx.getImageData(0, 0, W, H).data
    opaque = true
    for (let i = 3; i < d.length; i += 4)
      if (d[i] < 255) {
        opaque = false
        break
      }
  }
  return { canvas, box, opaque }
}
