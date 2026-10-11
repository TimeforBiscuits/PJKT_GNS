import { BLEED_MM, FORMATS, SAFE_MM } from '../model/formats'
import type { Cover, Frame, Layer } from '../model/doc'
import {
  apply,
  applyVec,
  distToSegment,
  frameBounds,
  frameMatrix,
  rotate,
  toLocal,
  type Pt,
} from '../model/geometry'
import { ptToMm } from '../model/units'
import type { Camera } from '../store/editor'

/** Is world point p on the layer, within tol mm? */
export function hitLayer(l: Layer, p: Pt, tol: number): boolean {
  const q = toLocal(l, p)
  if (l.kind === 'shape' && l.shape === 'line') {
    const sw = ptToMm(l.strokeWidthPt)
    return distToSegment(q, { x: 0, y: l.h / 2 }, { x: l.w, y: l.h / 2 }) <= Math.max(tol, sw / 2 + tol / 2)
  }
  const inside = q.x >= -tol && q.y >= -tol && q.x <= l.w + tol && q.y <= l.h + tol
  if (!inside) return false
  if (l.kind === 'shape' && !l.fill) {
    // Hollow shapes are only grabbed by their stroke, so they never block what's inside.
    const sw = l.stroke ? ptToMm(l.strokeWidthPt) : 0
    const band = (l.strokeAlign === 'inside' ? sw : l.strokeAlign === 'center' ? sw / 2 : 0) + tol
    return !(q.x > band && q.y > band && q.x < l.w - band && q.y < l.h - band)
  }
  return true
}

/** Topmost selectable layer under p. */
export const layerAt = (cover: Cover, p: Pt, tol: number): Layer | null => {
  for (let i = cover.layers.length - 1; i >= 0; i--) {
    const l = cover.layers[i]
    if (!l.hidden && !l.locked && hitLayer(l, p, tol)) return l
  }
  return null
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot' | 'a' | 'b'

export interface Handle {
  id: HandleId
  /** Position in the frame's own mm; for 'rot' the anchor it hangs from. */
  local: Pt
  /** Screen position. */
  s: Pt
}

const BOX: [HandleId, number, number][] = [
  ['nw', 0, 0],
  ['n', 0.5, 0],
  ['ne', 1, 0],
  ['e', 1, 0.5],
  ['se', 1, 1],
  ['s', 0.5, 1],
  ['sw', 0, 1],
  ['w', 0, 0.5],
]

export const ROT_OFFSET = 30

export const toScreen = (cam: Camera, p: Pt): Pt => ({ x: cam.x + p.x * cam.zoom, y: cam.y + p.y * cam.zoom })
export const toWorld = (cam: Camera, s: Pt): Pt => ({ x: (s.x - cam.x) / cam.zoom, y: (s.y - cam.y) / cam.zoom })

/** The handles a layer offers, in screen space. */
export function handlesFor(l: Layer, cam: Camera): Handle[] {
  const m = frameMatrix(l)
  const at = (local: Pt, id: HandleId): Handle => ({ id, local, s: toScreen(cam, apply(m, local)) })
  if (l.kind === 'shape' && l.shape === 'line') {
    return [at({ x: 0, y: l.h / 2 }, 'a'), at({ x: l.w, y: l.h / 2 }, 'b')]
  }
  const hs =
    l.kind === 'text'
      ? [at({ x: 0, y: l.h / 2 }, 'w'), at({ x: l.w, y: l.h / 2 }, 'e')]
      : BOX.map(([id, hx, hy]) => at({ x: hx * l.w, y: hy * l.h }, id))
  const top = at({ x: l.w / 2, y: 0 }, 'rot')
  const up = applyVec(rotate(l.rotation), { x: 0, y: -1 })
  hs.push({ ...top, s: { x: top.s.x + up.x * ROT_OFFSET, y: top.s.y + up.y * ROT_OFFSET } })
  return hs
}

/** Where the template's own lines are: edges, bleed, fold, panel centres and safe zone. */
export function coverSnapLines(cover: Cover) {
  const { w: W, h: H } = FORMATS[cover.formatId].trim
  const pw = W / 2
  const b = BLEED_MM
  const s = SAFE_MM
  return {
    x: [-b, 0, s, pw / 2, pw - s, pw, pw + s, pw * 1.5, W - s, W, W + b],
    y: [-b, 0, s, H / 2, H - s, H, H + b],
  }
}

export interface SnapResult {
  delta: number
  at: number | null
}

/** Best snap of any of `edges` onto any of `lines` within tol. */
export function snap1(edges: number[], lines: number[], tol: number): SnapResult {
  let best: SnapResult = { delta: 0, at: null }
  let bestD = tol
  for (const e of edges)
    for (const l of lines) {
      const d = Math.abs(l - e)
      if (d <= bestD) {
        bestD = d
        best = { delta: l - e, at: l }
      }
    }
  return best
}

/** Snap lines from the template plus every other visible layer's edges and centre. */
export function snapLines(cover: Cover, exclude: string) {
  const lines = coverSnapLines(cover)
  for (const l of cover.layers) {
    if (l.id === exclude || l.hidden) continue
    const b = frameBounds(l)
    lines.x.push(b.x, b.x + b.w / 2, b.x + b.w)
    lines.y.push(b.y, b.y + b.h / 2, b.y + b.h)
  }
  return lines
}

export const boundsEdges = (f: Frame) => {
  const b = frameBounds(f)
  return { x: [b.x, b.x + b.w / 2, b.x + b.w], y: [b.y, b.y + b.h / 2, b.y + b.h] }
}
