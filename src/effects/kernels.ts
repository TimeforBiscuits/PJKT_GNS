// The effects themselves, as pure functions over RGBA pixels. Every pattern
// is defined in the layer's own millimetres, not in pixels, so the screen
// preview (a few pixels per mm) and the print (600 dpi) show the same dots,
// the same scuffs, in the same places.

export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Where the pixel grid sits in the layer's frame: pixel (i, j) has its centre at (x0 + (i + ½)/k, y0 + (j + ½)/k) mm. */
export interface Grid {
  x0: number
  y0: number
  /** Pixels per mm. */
  k: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Antialiased coverage of a pixel by a disc edge: d and r in mm, k px/mm. */
const disc = (d: number, r: number, k: number) => clamp01((r - d) * k + 0.5)

// ───────────────────────────── Ben-Day dots ─────────────────────────────

/** Share of the area the dots cover at a strength: 0 → solid, 100 → a fifth. */
export const bendayCoverage = (strength: number) => 1 - 0.8 * clamp01(strength / 100)

/**
 * Flat colour turned to dots of the same colour, on a 45° screen. Only the
 * alpha changes: between the dots the layer becomes see-through.
 */
export function bendayFlat(px: Pixels, g: Grid, dotMm: number, strength: number) {
  const c = bendayCoverage(strength)
  if (c >= 1) return
  const p = Math.max(0.2, dotMm)
  const r = p * Math.sqrt(c / Math.PI)
  const s = Math.SQRT1_2
  const { data, width, height } = px
  for (let j = 0; j < height; j++) {
    const v = g.y0 + (j + 0.5) / g.k
    for (let i = 0; i < width; i++) {
      const o = (j * width + i) * 4 + 3
      if (data[o] === 0) continue
      const u = g.x0 + (i + 0.5) / g.k
      // into the screen's rotated cells
      const a = (u + v) * s
      const b = (v - u) * s
      const fa = a / p - Math.floor(a / p) - 0.5
      const fb = b / p - Math.floor(b / p) - 0.5
      const d = p * Math.sqrt(fa * fa + fb * fb)
      data[o] = Math.round(data[o] * disc(d, r, g.k))
    }
  }
}

// Process inks for the comic halftone, as they print on white.
const INKS: { angle: number; rgb: [number, number, number] }[] = [
  { angle: 15, rgb: [0, 174, 239] }, // cyan
  { angle: 75, rgb: [236, 0, 140] }, // magenta
  { angle: 0, rgb: [255, 242, 0] }, // yellow
  { angle: 45, rgb: [35, 31, 32] }, // black
]

/**
 * A picture as a comic-book print: four screens of process-colour dots, each
 * dot sized by how much of that ink the picture needs there. `sample` gives
 * the picture's colour (0–1 rgb) averaged over about a dot's width.
 * Strength mixes the print over the original.
 */
export function halftone(px: Pixels, g: Grid, dotMm: number, strength: number, sample: (u: number, v: number) => [number, number, number]) {
  const s = clamp01(strength / 100)
  if (s <= 0) return
  const p = Math.max(0.2, dotMm)
  // Every pixel of a dot shares its cell's ink amount: remember the last cell
  // each screen looked at, since neighbouring pixels nearly always share it.
  const screens = INKS.map((ink, n) => {
    const t = (ink.angle * Math.PI) / 180
    return { n, cos: Math.cos(t), sin: Math.sin(t), ink: ink.rgb.map((c) => c / 255), ia: NaN, ib: NaN, rad: 0 }
  })
  /** The amount of one process ink (0 C, 1 M, 2 Y, 3 K) a colour needs. */
  const inkOf = (n: number, rgb: [number, number, number]) => {
    const k = 1 - Math.max(rgb[0], rgb[1], rgb[2])
    if (n === 3) return k
    return k >= 1 ? 0 : (1 - rgb[n] - k) / (1 - k)
  }
  const { data, width, height } = px
  for (let j = 0; j < height; j++) {
    const v = g.y0 + (j + 0.5) / g.k
    for (let i = 0; i < width; i++) {
      const o = (j * width + i) * 4
      if (data[o + 3] === 0) continue
      const u = g.x0 + (i + 0.5) / g.k
      let R = 1
      let G = 1
      let B = 1
      for (const sc of screens) {
        // rotate into the screen and find the cell
        const a = u * sc.cos + v * sc.sin
        const b = -u * sc.sin + v * sc.cos
        const ia = Math.floor(a / p)
        const ib = Math.floor(b / p)
        if (ia !== sc.ia || ib !== sc.ib) {
          sc.ia = ia
          sc.ib = ib
          // sample the picture at the cell centre (rotated back)
          const ca = (ia + 0.5) * p
          const cb = (ib + 0.5) * p
          const amount = inkOf(sc.n, sample(ca * sc.cos - cb * sc.sin, ca * sc.sin + cb * sc.cos))
          sc.rad = amount <= 0.004 ? 0 : p * Math.sqrt(amount / Math.PI)
        }
        if (sc.rad === 0) continue
        const da = a - (ia + 0.5) * p
        const db = b - (ib + 0.5) * p
        const cov = disc(Math.sqrt(da * da + db * db), sc.rad, g.k)
        if (cov <= 0) continue
        R *= 1 - cov + cov * sc.ink[0]
        G *= 1 - cov + cov * sc.ink[1]
        B *= 1 - cov + cov * sc.ink[2]
      }
      data[o] = Math.round(data[o] * (1 - s) + R * 255 * s)
      data[o + 1] = Math.round(data[o + 1] * (1 - s) + G * 255 * s)
      data[o + 2] = Math.round(data[o + 2] * (1 - s) + B * 255 * s)
    }
  }
}

// ───────────────────────────── Distressed ─────────────────────────────

/** A small, fast, seeded random source. */
export function rng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (x: number, y: number, seed: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Value noise, 0–1, one feature per unit. */
export function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const tx = smooth(x - xi)
  const ty = smooth(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

/** Layered noise, 0–1: big shapes with finer detail on top. */
export function fbm(x: number, y: number, seed: number, octaves: number) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y, seed + o * 101) * amp
    norm += amp
    x *= 2.03
    y *= 2.03
    amp *= 0.5
  }
  return sum / norm
}

/** Alpha blurred over r pixels (box, both ways): how far inside the shape each pixel is. */
function blurAlpha(px: Pixels, r: number): Float32Array {
  const { data, width: w, height: h } = px
  const a = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3] / 255
  if (r < 1) return a
  const tmp = new Float32Array(w * h)
  const pass = (src: Float32Array, dst: Float32Array, n: number, m: number, idx: (line: number, t: number) => number) => {
    for (let line = 0; line < m; line++) {
      let acc = 0
      // zero beyond the edges
      for (let t = -r; t <= r; t++) if (t >= 0 && t < n) acc += src[idx(line, t)]
      for (let t = 0; t < n; t++) {
        dst[idx(line, t)] = acc / (2 * r + 1)
        const out = t - r
        const inn = t + r + 1
        if (out >= 0) acc -= src[idx(line, out)]
        if (inn < n) acc += src[idx(line, inn)]
      }
    }
  }
  pass(a, tmp, w, h, (line, t) => line * w + t)
  pass(tmp, a, h, w, (line, t) => t * w + line)
  return a
}

/** The plain layer's coverage at a fixed resolution: where the damage reads its edges from. */
export interface Shape {
  mask: Pixels
  grid: Grid
}

/** A planned piece of damage, in mm. */
type Cut =
  /** A chip or flake knocked clean out (bite 1), or a dent worn thin (bite < 1, streaked). */
  | { kind: 'poly'; pts: number[]; bite: number; streak: number | null }
  /** A sliver shaved off a straight edge. */
  | { kind: 'shave'; ex: number; ey: number; tx: number; ty: number; nx: number; ny: number; len: number; depth: number; wob: number }
  /** A scratch, scrape line or gouge along a path. */
  | { kind: 'line'; pts: number[]; half: number; bite: number; jag: number; wob: number }

/** Read the shape: blurred coverage (½ on the edge), its area, its box. */
function readShape({ mask, grid }: Shape) {
  const B = blurAlpha(mask, Math.max(1, Math.round(0.6 * grid.k)))
  let sum = 0
  for (let i = 3; i < mask.data.length; i += 4) sum += mask.data[i]
  const w = mask.width
  const h = mask.height
  const at = (u: number, v: number) => {
    const fx = (u - grid.x0) * grid.k - 0.5
    const fy = (v - grid.y0) * grid.k - 0.5
    if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) return 0
    const x = Math.min(w - 2, Math.floor(fx))
    const y = Math.min(h - 2, Math.floor(fy))
    const tx = fx - x
    const ty = fy - y
    const a = B[y * w + x]
    const b = B[y * w + x + 1]
    const c = B[(y + 1) * w + x]
    const d = B[(y + 1) * w + x + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }
  return { at, area: sum / 255 / (grid.k * grid.k), x0: grid.x0, y0: grid.y0, x1: grid.x0 + w / grid.k, y1: grid.y0 + h / grid.k }
}

/** An irregular flake outline around a centre, stretched along (tx, ty). */
function flake(rand: () => number, cx: number, cy: number, r: number, stretch: number, tx: number, ty: number): number[] {
  const n = 9 + Math.floor(rand() * 6)
  const pts: number[] = []
  const a0 = rand() * Math.PI * 2
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + (rand() - 0.5) * 0.8) / n) * Math.PI * 2
    // alternate in and out a little, for a broken, conchoidal rim
    const rad = r * (i % 2 ? 0.3 + rand() * 0.6 : 0.6 + rand() * 0.6)
    const lx = Math.cos(a) * rad * stretch
    const ly = Math.sin(a) * rad
    pts.push(cx + tx * lx - ty * ly, cy + ty * lx + tx * ly)
  }
  return pts
}

/** A gently bent path of n points from a centre, length and angle. */
function bentPath(cx: number, cy: number, len: number, ang: number, bend: number, n = 8): number[] {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const pts: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n - 0.5
    const off = bend * (1 - 4 * t * t)
    pts.push(cx + dx * t * len - dy * off, cy + dy * t * len + dx * off)
  }
  return pts
}

/** Plan the damage: chips and shavings on the edges, flakes and dents inside, scratches across. */
function plan(shape: ReturnType<typeof readShape>, s: number, size: number, seed: number): Cut[] {
  const cuts: Cut[] = []
  const { at, area } = shape
  // Walk the edge in 0.6 mm cells; each cell rolls its own dice, so the plan
  // doesn't depend on how finely the layer is drawn.
  const cell = 0.6
  for (let cy = Math.floor(shape.y0 / cell); cy * cell < shape.y1; cy++)
    for (let cx = Math.floor(shape.x0 / cell); cx * cell < shape.x1; cx++) {
      const u = (cx + 0.5) * cell
      const v = (cy + 0.5) * cell
      const b = at(u, v)
      if (b < 0.15 || b > 0.85) continue
      const d = 0.25
      const gx = (at(u + d, v) - at(u - d, v)) / (2 * d)
      const gy = (at(u, v + d) - at(u, v - d)) / (2 * d)
      const gl = Math.hypot(gx, gy)
      if (gl < 0.05) continue
      const nx = -gx / gl
      const ny = -gy / gl
      const tx = -ny
      const ty = nx
      // onto the edge itself
      const ex = u + nx * ((b - 0.5) / gl)
      const ey = v + ny * ((b - 0.5) / gl)
      // corners stick out: off the end of a straight run there's less shape
      const corner = clamp01((0.5 - Math.min(at(ex + tx * 1.2, ey + ty * 1.2), at(ex - tx * 1.2, ey - ty * 1.2))) * 3)
      const rand = rng(Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(seed, 83492791))
      const roll = rand()
      if (roll < 0.075 * s * s * (1 + 3 * corner)) {
        const r = (0.18 + 2.2 * rand() ** 2.6) * (0.6 + 0.6 * s) * size
        const ox = ex - nx * r * 0.2
        const oy = ey - ny * r * 0.2
        cuts.push({ kind: 'poly', pts: flake(rand, ox, oy, r, 1.2 + rand() * 1.4, tx, ty), bite: 1, streak: null })
      } else if (corner < 0.15 && roll > 1 - 0.012 * s) {
        // a ding: the edge knocked in, short and round
        cuts.push({ kind: 'shave', ex, ey, tx, ty, nx, ny, len: (1.2 + 3 * rand()) * size, depth: (0.15 + 0.5 * rand()) * (0.4 + s) * size, wob: Math.floor(rand() * 1e6) })
      } else if (corner < 0.15 && roll > 1 - 0.012 * s - 0.014 * s ** 1.3) {
        cuts.push({
          kind: 'shave',
          ex,
          ey,
          tx,
          ty,
          nx,
          ny,
          len: (3 + 15 * rand()) * size,
          depth: (0.05 + 0.35 * rand() ** 2) * (0.5 + s) * size,
          wob: Math.floor(rand() * 1e6),
        })
      }
    }

  const rand = rng(seed * 7919 + 13)
  const W = shape.x1 - shape.x0
  const H = shape.y1 - shape.y0
  const inside = (min: number) => {
    for (let tries = 0; tries < 12; tries++) {
      const u = shape.x0 + rand() * W
      const v = shape.y0 + rand() * H
      if (at(u, v) > min) return [u, v]
    }
    return null
  }
  // Flakes: paint knocked off the face.
  for (let i = Math.round(area * 0.0016 * s ** 1.5); i > 0; i--) {
    const p = inside(0.6)
    if (!p) continue
    const a = rand() * Math.PI
    cuts.push({ kind: 'poly', pts: flake(rand, p[0], p[1], (0.12 + 0.9 * rand() ** 2.5) * size, 1 + rand(), Math.cos(a), Math.sin(a)), bite: 1, streak: null })
  }
  // Dents and scuffs: the finish worn thin in streaks, not through.
  for (let i = Math.round(area * 0.0008 * s + s * 1.2); i > 0; i--) {
    const p = inside(0.9)
    if (!p) continue
    const a = rand() * Math.PI
    cuts.push({
      kind: 'poly',
      pts: flake(rand, p[0], p[1], (0.6 + 2.8 * rand() ** 1.5) * size, 1 + rand() * 1.5, Math.cos(a), Math.sin(a)),
      bite: 0.55 + 0.4 * rand(),
      streak: a,
    })
  }
  // Scratches: hairlines every which way, scrapes in parallel runs from
  // being dragged one way, and a few deep gouges.
  const dir = rand() * Math.PI
  for (let i = Math.round((area / 120) * s + 3 * s); i > 0; i--) {
    const len = (5 + 45 * rand() ** 1.5) * Math.max(0.5, size)
    cuts.push({
      kind: 'line',
      pts: bentPath(shape.x0 + rand() * W, shape.y0 + rand() * H, len, dir + (rand() - 0.5) * 2, (rand() - 0.5) * 0.12 * len),
      half: 0.012 + 0.035 * rand(),
      bite: 0.45 + 0.55 * rand(),
      jag: 0.3,
      wob: Math.floor(rand() * 1e6),
    })
  }
  for (let i = Math.round((area / 1100) * 3 * s + s); i > 0; i--) {
    const cx = shape.x0 + rand() * W
    const cy = shape.y0 + rand() * H
    const ang = dir + (rand() - 0.5) * 0.6
    const len = (3 + 13 * rand()) * Math.max(0.5, size)
    const gap = 0.1 + 0.35 * rand()
    for (let j = 2 + Math.floor(rand() * 6); j > 0; j--) {
      const off = j * gap + (rand() - 0.5) * gap
      const slide = (rand() - 0.5) * len * 0.4
      cuts.push({
        kind: 'line',
        pts: bentPath(cx - Math.sin(ang) * off + Math.cos(ang) * slide, cy + Math.cos(ang) * off + Math.sin(ang) * slide, len * (0.5 + rand() * 0.5), ang + (rand() - 0.5) * 0.05, 0),
        half: 0.015 + 0.05 * rand(),
        bite: 0.35 + 0.55 * rand(),
        jag: 0.4,
        wob: Math.floor(rand() * 1e6),
      })
    }
  }
  for (let i = Math.round((area / 5000) * 3 * s * s + (s > 0.6 ? 1 : 0)); i > 0; i--) {
    const len = (2 + 7 * rand()) * size
    cuts.push({
      kind: 'line',
      pts: bentPath(shape.x0 + rand() * W, shape.y0 + rand() * H, len, rand() * Math.PI, (rand() - 0.5) * 0.3 * len),
      half: (0.1 + 0.18 * rand()) * size,
      bite: 1,
      jag: 0.7,
      wob: Math.floor(rand() * 1e6),
    })
  }
  return cuts
}

/** Signed distance from (u, v) to a closed polygon: negative inside. */
function polyDistance(pts: number[], u: number, v: number) {
  let best = Infinity
  let inside = false
  const n = pts.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = pts[j * 2]
    const ay = pts[j * 2 + 1]
    const bx = pts[i * 2]
    const by = pts[i * 2 + 1]
    if (ay > v !== by > v && u < ((bx - ax) * (v - ay)) / (by - ay) + ax) inside = !inside
    const dx = bx - ax
    const dy = by - ay
    const t = clamp01(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy || 1))
    const ex = u - ax - t * dx
    const ey = v - ay - t * dy
    const d = ex * ex + ey * ey
    if (d < best) best = d
  }
  return inside ? -Math.sqrt(best) : Math.sqrt(best)
}

/** Lay one cut into the removal map (the most any cut takes from a pixel). */
function carve(cut: Float32Array, px: Pixels, g: Grid, c: Cut) {
  const { width, height } = px
  const k = g.k
  const span = (x0: number, y0: number, x1: number, y1: number, f: (u: number, v: number) => number) => {
    const i0 = Math.max(0, Math.floor((x0 - g.x0) * k))
    const i1 = Math.min(width - 1, Math.ceil((x1 - g.x0) * k))
    const j0 = Math.max(0, Math.floor((y0 - g.y0) * k))
    const j1 = Math.min(height - 1, Math.ceil((y1 - g.y0) * k))
    for (let j = j0; j <= j1; j++) {
      const v = g.y0 + (j + 0.5) / k
      for (let i = i0; i <= i1; i++) {
        const n = j * width + i
        if (px.data[n * 4 + 3] === 0) continue
        const take = f(g.x0 + (i + 0.5) / k, v)
        if (take > cut[n]) cut[n] = take
      }
    }
  }
  if (c.kind === 'poly') {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < c.pts.length; i += 2) {
      x0 = Math.min(x0, c.pts[i])
      x1 = Math.max(x1, c.pts[i])
      y0 = Math.min(y0, c.pts[i + 1])
      y1 = Math.max(y1, c.pts[i + 1])
    }
    const cos = c.streak === null ? 0 : Math.cos(c.streak)
    const sin = c.streak === null ? 0 : Math.sin(c.streak)
    span(x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2, (u, v) => {
      const sd = polyDistance(c.pts, u, v)
      if (c.streak === null) return clamp01(0.5 - sd * k)
      // scuffed: fine scratches packed one way, fading out at the rim
      const along = u * cos + v * sin
      const across = -u * sin + v * cos
      const streak = noise(along * 0.8, across * 14, 77) * 0.7 + noise(along * 2, across * 31, 78) * 0.3
      return clamp01(-sd / 0.6) * c.bite * clamp01((streak - 0.52) / 0.12)
    })
    return
  }
  if (c.kind === 'shave') {
    const r = c.len / 2 + 0.2
    const reach = c.depth * 1.6 + 0.3
    span(Math.min(c.ex - r, c.ex - reach), Math.min(c.ey - r, c.ey - reach), Math.max(c.ex + r, c.ex + reach), Math.max(c.ey + r, c.ey + reach), (u, v) => {
      const a = (u - c.ex) * c.tx + (v - c.ey) * c.ty
      const out = (u - c.ex) * c.nx + (v - c.ey) * c.ny
      const q = (2 * a) / c.len
      if (q <= -1 || q >= 1 || out < -reach) return 0
      const depth = c.depth * Math.sqrt(1 - q * q) * (0.6 + 0.4 * noise(a * 1.4, 0.5, c.wob))
      return clamp01((out + depth) * k + 0.5)
    })
    return
  }
  // A line: stamp discs along the path, tapering at both ends.
  const pts = c.pts
  let total = 0
  for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
  if (total <= 0) return
  const step = Math.min(0.5 / k, c.half * 0.7 + 0.2 / k)
  let walked = 0
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2]
    const ay = pts[i - 1]
    const seg = Math.hypot(pts[i] - ax, pts[i + 1] - ay)
    const dx = (pts[i] - ax) / (seg || 1)
    const dy = (pts[i + 1] - ay) / (seg || 1)
    for (let d = 0; d < seg; d += step) {
      const t = (walked + d) / total
      const half = c.half * Math.pow(Math.sin(Math.PI * t), 0.5) * (1 + c.jag * (noise((walked + d) * 2.5, 0.5, c.wob) - 0.5))
      if (half <= 0) continue
      const x = ax + dx * d
      const y = ay + dy * d
      const reach = half + 1 / k
      span(x - reach, y - reach, x + reach, y + reach, (u, v) => disc(Math.hypot(u - x, v - y), half, k) * c.bite)
    }
    walked += seg
  }
}

/**
 * Wear and abuse, like an old cabinet that's been moved once too often:
 * chips knocked out of edges and corners, slivers shaved off straight runs,
 * flakes and dents in the face, hairline scratches, dragged scrapes and a
 * few gouges. On small things (type) a stamp-like speckle joins in; on big
 * ones it stays faint. Worn areas become see-through (paper shows).
 *
 * `shape` is the plain layer at a fixed resolution: the damage is planned
 * from it, so a preview and a 600 dpi print get the same damage.
 */
export function distress(px: Pixels, g: Grid, strength: number, seed: number, shape: Shape = { mask: px, grid: g }) {
  const s = clamp01(strength / 100)
  if (s <= 0) return
  const read = readShape(shape)
  const scale = Math.sqrt(read.area)
  const size = Math.min(1.2, Math.max(0.35, scale / 50))
  // The stamp texture suits small things; on big ones it reads as spray paint.
  const stamp = s * Math.min(1, Math.max(0.06, 1.35 - scale / 50))
  mottle(px, g, stamp, seed)
  const cut = new Float32Array(px.width * px.height)
  for (const c of plan(read, s, size, seed)) carve(cut, px, g, c)
  const { data } = px
  for (let n = 0; n < cut.length; n++) if (cut[n] > 0) data[n * 4 + 3] = Math.round(data[n * 4 + 3] * (1 - cut[n]))
}

/** The printed-stamp texture: ink thinning in patches, pinholes, roughened edges. */
function mottle(px: Pixels, g: Grid, m: number, seed: number) {
  if (m <= 0.01) return
  const { data, width, height } = px
  const inner = blurAlpha(px, Math.round(0.9 * g.k))
  const step = 0.5
  const gx0 = Math.floor(g.x0 / step) - 1
  const gy0 = Math.floor(g.y0 / step) - 1
  const gw = Math.ceil(width / g.k / step) + 3
  const gh = Math.ceil(height / g.k / step) + 3
  const patch = new Float32Array(gw * gh)
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) patch[y * gw + x] = fbm((gx0 + x) * step * 0.3, (gy0 + y) * step * 0.3, seed, 4)
  const patchAt = (u: number, v: number) => {
    const fx = u / step - gx0
    const fy = v / step - gy0
    const x = Math.min(gw - 2, Math.max(0, Math.floor(fx)))
    const y = Math.min(gh - 2, Math.max(0, Math.floor(fy)))
    const tx = fx - x
    const ty = fy - y
    const a = patch[y * gw + x]
    const b = patch[y * gw + x + 1]
    const c = patch[(y + 1) * gw + x]
    const d = patch[(y + 1) * gw + x + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }
  const bar = 0.8 - 0.3 * m
  // pinholes only once the stamp texture is really on (small things)
  const pinBar = 1.12 - 0.335 * m
  for (let j = 0; j < height; j++) {
    const v = g.y0 + (j + 0.5) / g.k
    for (let i = 0; i < width; i++) {
      const n = j * width + i
      const o = n * 4 + 3
      if (data[o] === 0) continue
      const u = g.x0 + (i + 0.5) / g.k
      const edge = 1 - inner[n]
      const patch = patchAt(u, v)
      const wear = patch * 0.74 + noise(u * 6, v * 6, seed + 7) * 0.26 + edge * (0.25 + 0.4 * m)
      let keep = wear > bar ? 1 - clamp01((wear - bar) / 0.03) : 1 - 0.22 * m * clamp01((wear - bar + 0.12) / 0.12)
      const pin = noise(u * 15, v * 15, seed + 11) + (patch - 0.5) * 0.35
      if (pin > pinBar) keep *= 1 - clamp01((pin - pinBar) / 0.02)
      if (keep < 1) data[o] = Math.round(data[o] * keep)
    }
  }
}
