import type { Frame } from './doc'

// 2D affine matrices in SVG/PDF order: x' = a·x + c·y + e, y' = b·x + d·y + f.

export type Mat = [a: number, b: number, c: number, d: number, e: number, f: number]

export interface Pt {
  x: number
  y: number
}

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0]

export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y]
export const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, sy, 0, 0]
export const rotate = (deg: number): Mat => {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [c, s, -s, c, 0, 0]
}

export const apply = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })

/** Apply only the linear part (for directions and sizes). */
export const applyVec = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y, y: m[1] * p.x + m[3] * p.y })

export const invert = (m: Mat): Mat => {
  const det = m[0] * m[3] - m[1] * m[2]
  const a = m[3] / det
  const b = -m[1] / det
  const c = -m[2] / det
  const d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

export const svgMatrix = (m: Mat) => `matrix(${m.join(' ')})`

/** Frame-local mm (0..w, 0..h) → cover mm. */
export const frameMatrix = (f: Frame): Mat =>
  mul(translate(f.x + f.w / 2, f.y + f.h / 2), mul(rotate(f.rotation), translate(-f.w / 2, -f.h / 2)))

export const frameCenter = (f: Frame): Pt => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 })

export const frameCorners = (f: Frame): Pt[] => {
  const m = frameMatrix(f)
  return [
    { x: 0, y: 0 },
    { x: f.w, y: 0 },
    { x: f.w, y: f.h },
    { x: 0, y: f.h },
  ].map((p) => apply(m, p))
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Axis-aligned bounds of a rotated frame. */
export const frameBounds = (f: Frame): Box => {
  const pts = frameCorners(f)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** A frame with a new local box (in the old frame's own coordinates), keeping rotation. */
export const reframe = (f: Frame, l: number, t: number, r: number, b: number): Frame => {
  const c = apply(frameMatrix(f), { x: (l + r) / 2, y: (t + b) / 2 })
  const w = r - l
  const h = b - t
  return { x: c.x - w / 2, y: c.y - h / 2, w, h, rotation: f.rotation }
}

export const toLocal = (f: Frame, p: Pt): Pt => apply(invert(frameMatrix(f)), p)

export const normDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Distance from p to segment ab. */
export const distToSegment = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
