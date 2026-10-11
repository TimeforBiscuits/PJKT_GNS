import type { ShapeLayer } from './doc'
import type { Mat } from './geometry'

// Vector paths shared by the on-screen renderer and the PDF writer, so both
// draw exactly the same outlines.

export type PathCmd =
  | ['M', number, number]
  | ['L', number, number]
  | ['C', number, number, number, number, number, number]
  | ['Z']

export type Path = PathCmd[]

/** Bézier handle length for a quarter circle. */
const K = 0.5522847498

const r4 = (v: number) => Math.round(v * 1e4) / 1e4

export const toSvgD = (p: Path): string =>
  p
    .map((c) => {
      switch (c[0]) {
        case 'M':
        case 'L':
          return `${c[0]}${r4(c[1])} ${r4(c[2])}`
        case 'C':
          return `C${r4(c[1])} ${r4(c[2])} ${r4(c[3])} ${r4(c[4])} ${r4(c[5])} ${r4(c[6])}`
        case 'Z':
          return 'Z'
      }
    })
    .join('')

export const transformPath = (p: Path, m: Mat): Path => {
  const t = (x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
  return p.map((c): PathCmd => {
    switch (c[0]) {
      case 'M':
        return ['M', ...t(c[1], c[2])]
      case 'L':
        return ['L', ...t(c[1], c[2])]
      case 'C':
        return ['C', ...t(c[1], c[2]), ...t(c[3], c[4]), ...t(c[5], c[6])]
      case 'Z':
        return c
    }
  })
}

export const rectPath = (x: number, y: number, w: number, h: number, radius = 0): Path => {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  if (r === 0) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']]
  const k = r * (1 - K)
  return [
    ['M', x + r, y],
    ['L', x + w - r, y],
    ['C', x + w - k, y, x + w, y + k, x + w, y + r],
    ['L', x + w, y + h - r],
    ['C', x + w, y + h - k, x + w - k, y + h, x + w - r, y + h],
    ['L', x + r, y + h],
    ['C', x + k, y + h, x, y + h - k, x, y + h - r],
    ['L', x, y + r],
    ['C', x, y + k, x + k, y, x + r, y],
    ['Z'],
  ]
}

export const ellipsePath = (w: number, h: number): Path => {
  const rx = w / 2
  const ry = h / 2
  const ox = rx * K
  const oy = ry * K
  return [
    ['M', rx, 0],
    ['C', rx + ox, 0, w, ry - oy, w, ry],
    ['C', w, ry + oy, rx + ox, h, rx, h],
    ['C', rx - ox, h, 0, ry + oy, 0, ry],
    ['C', 0, ry - oy, rx - ox, 0, rx, 0],
    ['Z'],
  ]
}

/** Regular polygon with a point at the top, stretched to fill w × h. */
export const polygonPoints = (w: number, h: number, sides: number) => {
  const n = Math.max(3, Math.round(sides))
  const raw = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: Math.cos(a), y: Math.sin(a) }
  })
  // Scale the polygon's own bounds (not the circle's) to the frame.
  const minX = Math.min(...raw.map((p) => p.x))
  const maxX = Math.max(...raw.map((p) => p.x))
  const minY = Math.min(...raw.map((p) => p.y))
  const maxY = Math.max(...raw.map((p) => p.y))
  return raw.map((p) => ({ x: ((p.x - minX) / (maxX - minX)) * w, y: ((p.y - minY) / (maxY - minY)) * h }))
}

export const polygonPath = (w: number, h: number, sides: number): Path => {
  const pts = polygonPoints(w, h, sides)
  return [['M', pts[0].x, pts[0].y], ...pts.slice(1).map((p): PathCmd => ['L', p.x, p.y]), ['Z']]
}

/** A shape's outline in its own frame coordinates. Lines run along the frame's centre line. */
export const shapePath = (s: Pick<ShapeLayer, 'shape' | 'w' | 'h' | 'radius' | 'sides'>): Path => {
  switch (s.shape) {
    case 'rect':
      return rectPath(0, 0, s.w, s.h, s.radius)
    case 'ellipse':
      return ellipsePath(s.w, s.h)
    case 'polygon':
      return polygonPath(s.w, s.h, s.sides)
    case 'line':
      return [
        ['M', 0, s.h / 2],
        ['L', s.w, s.h / 2],
      ]
  }
}

export const isClosed = (p: Path) => p.some((c) => c[0] === 'Z')
