import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { TextLayer } from '../model/doc'
import type { FaceFor, ShapingFont } from '../model/text'
import { CATALOG, facesFor, fileKey, filesFor, fontEntry, nearestWeight, type FontEntry, type FontFile } from './variants'

export { CATALOG, DEFAULT_FAMILY, fontEntry, nearestWeight, type FontCategory, type FontEntry } from './variants'

export const fontUrl = (f: FontFile) => `${import.meta.env.BASE_URL}fonts/${fileKey(f)}.woff2`

/** Parsed fonts by file key; components re-render as they arrive. */
const useLoaded = create<{ fonts: Record<string, ShapingFont> }>(() => ({ fonts: {} }))

const pending = new Map<string, Promise<ShapingFont>>()

/** Fetch and parse one font file (once). */
export function loadFile(f: FontFile): Promise<ShapingFont> {
  const k = fileKey(f)
  const have = useLoaded.getState().fonts[k]
  if (have) return Promise.resolve(have)
  let p = pending.get(k)
  if (!p) {
    p = fetch(fontUrl(f))
      .then((r) => {
        if (!r.ok) throw new Error(`Font ${f.entry.family} ${f.weight}${f.italic ? ' italic' : ''} is missing (${r.status})`)
        return r.arrayBuffer()
      })
      .then(async (buf) => {
        // The font engine is large; it loads the first time type is needed.
        const { create: createFont } = await import('fontkit')
        const font = createFont(new Uint8Array(buf) as unknown as Buffer) as unknown as ShapingFont
        useLoaded.setState((s) => ({ fonts: { ...s.fonts, [k]: font } }))
        return font
      })
    p.catch(() => pending.delete(k))
    pending.set(k, p)
  }
  return p
}

const upright = (family: string, weight: number): FontFile => {
  const entry = fontEntry(family)
  return { entry, weight: nearestWeight(entry, weight), italic: false }
}

/** Load an upright font by family and weight. */
export const loadFont = (family: string, weight: number) => loadFile(upright(family, weight))

export const fileSync = (f: FontFile): ShapingFont | null => useLoaded.getState().fonts[fileKey(f)] ?? null

export const fontSync = (family: string, weight: number) => fileSync(upright(family, weight))

/** Load every font a text layer uses. */
export const loadTextFonts = (t: Pick<TextLayer, 'family' | 'weight' | 'text' | 'spans'>) => Promise.all(filesFor(t).map(loadFile))

/** Faces for a text layer once all its fonts are in; starts loading any that aren't. */
export function useFaces(t: Pick<TextLayer, 'family' | 'weight' | 'text' | 'spans'>): FaceFor | null {
  const files = filesFor(t)
  const keys = files.map(fileKey)
  const fonts = useLoaded(useShallow((s) => keys.map((k) => s.fonts[k] ?? null)))
  const missing = fonts.some((f) => !f)
  const sig = keys.join('|')
  useEffect(() => {
    if (missing) for (const f of filesFor(t)) loadFile(f).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, missing])
  // Stable while the same fonts serve the same styles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (missing ? null : facesFor(t, fileSync)), [sig, missing, ...fonts])
}

const cssLoaded = new Set<string>()

/** Register a font with the browser too, so the picker and text box can show it. */
export function cssFamily(e: FontEntry, weight: number, italic = false): string {
  const name = `GNS ${e.family}`
  const f: FontFile = { entry: e, weight, italic }
  const k = fileKey(f)
  if (!cssLoaded.has(k) && typeof FontFace !== 'undefined') {
    cssLoaded.add(k)
    const face = new FontFace(name, `url(${fontUrl(f)}) format('woff2')`, { weight: String(weight), style: italic ? 'italic' : 'normal' })
    face
      .load()
      .then((ff) => document.fonts.add(ff))
      .catch(() => cssLoaded.delete(k))
  }
  return `'${name}'`
}

/** Every font file in the library, for offline caching. */
export const allFontUrls = () =>
  CATALOG.flatMap((entry) => [
    ...entry.weights.map((weight) => fontUrl({ entry, weight, italic: false })),
    ...entry.italics.map((weight) => fontUrl({ entry, weight, italic: true })),
  ])
