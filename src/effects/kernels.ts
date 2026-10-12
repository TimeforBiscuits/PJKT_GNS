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

/**
 * Wear: fine speckle, worn patches and eaten edges knocked out of the alpha,
 * plus scuffs scraped across. Worn areas become see-through (paper shows).
 */
export function distress(px: Pixels, g: Grid, strength: number, seed: number) {
  const s = clamp01(strength / 100)
  if (s <= 0) return
  const { data, width, height } = px
  // How close each pixel is to the shape's edge (1 at the edge, 0 well inside).
  const inner = blurAlpha(px, Math.round(0.9 * g.k))
  // Worn patches change slowly: work them out on a coarse grid and blend.
  const step = 0.5 // mm
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
  // Wear builds where the coarse patches are high, near edges, and as pinholes
  // everywhere; strength lowers every bar. Just short of a bar the ink fades.
  const bar = 0.8 - 0.3 * s
  const pinBar = 0.985 - 0.2 * s
  for (let j = 0; j < height; j++) {
    const v = g.y0 + (j + 0.5) / g.k
    for (let i = 0; i < width; i++) {
      const n = j * width + i
      const o = n * 4 + 3
      if (data[o] === 0) continue
      const u = g.x0 + (i + 0.5) / g.k
      const edge = 1 - inner[n]
      const patch = patchAt(u, v)
      const grain = noise(u * 6, v * 6, seed + 7)
      const wear = patch * 0.74 + grain * 0.26 + edge * (0.25 + 0.4 * s)
      let keep = wear > bar ? 1 - clamp01((wear - bar) / 0.03) : 1 - 0.22 * s * clamp01((wear - bar + 0.12) / 0.12)
      // pinholes: denser where the print is already worn
      const pin = noise(u * 15, v * 15, seed + 11) + (patch - 0.5) * 0.35
      if (pin > pinBar) keep *= 1 - clamp01((pin - pinBar) / 0.02)
      if (keep < 1) data[o] = Math.round(data[o] * keep)
    }
  }
  // Scuffs: mostly fine scrapes from handling, roughly one way, plus a few strays.
  const rand = rng(seed * 7919 + 13)
  const wMm = width / g.k
  const hMm = height / g.k
  const count = Math.round(((wMm * hMm) / 1500) * 18 * s + s * 3)
  const dir = rand() * Math.PI
  for (let c = 0; c < count; c++) {
    const stray = rand() < 0.3
    const len = (stray ? 1 : 3) + rand() * (stray ? 5 : 12)
    const ang = stray ? rand() * Math.PI : dir + (rand() - 0.5) * 1.2
    const cx = g.x0 + rand() * wMm
    const cy = g.y0 + rand() * hMm
    const ax = cx - (Math.cos(ang) * len) / 2
    const ay = cy - (Math.sin(ang) * len) / 2
    const bx = cx + (Math.cos(ang) * len) / 2
    const by = cy + (Math.sin(ang) * len) / 2
    const half = (0.02 + rand() * rand() * 0.12) * (0.7 + 0.6 * s)
    const bite = 0.3 + rand() * 0.7
    scrape(px, g, ax, ay, bx, by, half, bite)
  }
}

/** Take a scrape out of the alpha along a segment, tapering at both ends. */
function scrape(px: Pixels, g: Grid, ax: number, ay: number, bx: number, by: number, half: number, bite: number) {
  const { data, width, height } = px
  const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - half - g.x0) * g.k))
  const i1 = Math.min(width - 1, Math.ceil((Math.max(ax, bx) + half - g.x0) * g.k))
  const j0 = Math.max(0, Math.floor((Math.min(ay, by) - half - g.y0) * g.k))
  const j1 = Math.min(height - 1, Math.ceil((Math.max(ay, by) + half - g.y0) * g.k))
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1
  for (let j = j0; j <= j1; j++) {
    const v = g.y0 + (j + 0.5) / g.k
    for (let i = i0; i <= i1; i++) {
      const o = (j * width + i) * 4 + 3
      if (data[o] === 0) continue
      const u = g.x0 + (i + 0.5) / g.k
      const t = clamp01(((u - ax) * dx + (v - ay) * dy) / l2)
      const ex = u - (ax + t * dx)
      const ey = v - (ay + t * dy)
      const d = Math.sqrt(ex * ex + ey * ey)
      const taper = Math.sin(Math.PI * t)
      const cov = disc(d, half * taper, g.k) * bite
      if (cov > 0) data[o] = Math.round(data[o] * (1 - cov))
    }
  }
}
