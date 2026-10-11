import { useEffect } from 'react'
import { create } from 'zustand'
import type { ShapingFont } from '../model/text'
import catalogJson from './catalog.json'

export type FontCategory = 'sans' | 'serif' | 'mono'

export interface FontEntry {
  id: string
  family: string
  category: FontCategory
  style: string
  weights: number[]
}

export const CATALOG = catalogJson as FontEntry[]
export const DEFAULT_FAMILY = 'Inter Tight'

const byFamily = new Map(CATALOG.map((f) => [f.family, f]))

export const fontEntry = (family: string): FontEntry => byFamily.get(family) ?? byFamily.get(DEFAULT_FAMILY)!

/** The available weight closest to the one asked for. */
export const nearestWeight = (e: FontEntry, w: number) =>
  e.weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), e.weights[0])

export const fontUrl = (e: FontEntry, weight: number) => `${import.meta.env.BASE_URL}fonts/${e.id}-${weight}.woff2`

const key = (e: FontEntry, w: number) => `${e.id}-${w}`

/** Which fonts have finished loading; components re-render as they arrive. */
const useLoaded = create<{ fonts: Record<string, ShapingFont> }>(() => ({ fonts: {} }))

const pending = new Map<string, Promise<ShapingFont>>()

/** Fetch and parse a cover font (once). */
export function loadFont(family: string, weight: number): Promise<ShapingFont> {
  const e = fontEntry(family)
  const w = nearestWeight(e, weight)
  const k = key(e, w)
  const have = useLoaded.getState().fonts[k]
  if (have) return Promise.resolve(have)
  let p = pending.get(k)
  if (!p) {
    p = fetch(fontUrl(e, w))
      .then((r) => {
        if (!r.ok) throw new Error(`Font ${e.family} ${w} is missing (${r.status})`)
        return r.arrayBuffer()
      })
      .then(async (buf) => {
        // The font engine is large; it loads the first time type is needed.
        const { create: createFont } = await import('fontkit')
        const shaping = createFont(new Uint8Array(buf) as unknown as Buffer) as unknown as ShapingFont
        useLoaded.setState((s) => ({ fonts: { ...s.fonts, [k]: shaping } }))
        return shaping
      })
    p.catch(() => pending.delete(k))
    pending.set(k, p)
  }
  return p
}

/** The parsed font if it's loaded; starts loading it otherwise. */
export function useFont(family: string, weight: number): ShapingFont | null {
  const e = fontEntry(family)
  const k = key(e, nearestWeight(e, weight))
  const font = useLoaded((s) => s.fonts[k] ?? null)
  useEffect(() => {
    if (!font) loadFont(family, weight).catch(() => undefined)
  }, [font, family, weight])
  return font
}

export const fontSync = (family: string, weight: number): ShapingFont | null => {
  const e = fontEntry(family)
  return useLoaded.getState().fonts[key(e, nearestWeight(e, weight))] ?? null
}

const cssLoaded = new Set<string>()

/** Register the font with the browser too, so the picker can show each family in itself. */
export function cssFamily(e: FontEntry, weight: number): string {
  const name = `GNS ${e.family}`
  const k = key(e, weight)
  if (!cssLoaded.has(k) && typeof FontFace !== 'undefined') {
    cssLoaded.add(k)
    const face = new FontFace(name, `url(${fontUrl(e, weight)}) format('woff2')`, { weight: String(weight) })
    face
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => cssLoaded.delete(k))
  }
  return `'${name}'`
}

/** Every font file in the library, for offline caching. */
export const allFontUrls = () => CATALOG.flatMap((e) => e.weights.map((w) => fontUrl(e, w)))
