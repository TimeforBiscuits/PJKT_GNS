import type { TextLayer } from '../model/doc'
import { stylesUsed } from '../model/richtext'
import type { Face, FaceFor, ShapingFont } from '../model/text'
import catalogJson from './catalog.json'

// Which font file a bold or italic word is set in. Real bold and italic
// cuts are used when the family has them; otherwise the outlines are
// slanted (italic) or thickened (bold), as design apps do.

export type FontCategory = 'sans' | 'serif' | 'mono'

export interface FontEntry {
  id: string
  family: string
  category: FontCategory
  style: string
  weights: number[]
  italics: number[]
}

export const CATALOG = catalogJson as FontEntry[]
export const DEFAULT_FAMILY = 'Inter Tight'

const byFamily = new Map(CATALOG.map((f) => [f.family, f]))

export const fontEntry = (family: string): FontEntry => byFamily.get(family) ?? byFamily.get(DEFAULT_FAMILY)!

const nearest = (list: number[], w: number) => list.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), list[0])

/** The available upright weight closest to the one asked for. */
export const nearestWeight = (e: FontEntry, w: number) => nearest(e.weights, w)

/** A synthetic italic leans 12°. */
export const SLANT = Math.tan((12 * Math.PI) / 180)
/** A synthetic bold adds an outline stroke this fraction of the em wide. */
export const EMBOLDEN = 0.032

/** One font file: family entry, weight, upright or italic. */
export interface FontFile {
  entry: FontEntry
  weight: number
  italic: boolean
}

export interface Variant extends FontFile {
  slant: number
  embolden: number
}

export const fileKey = (f: FontFile) => `${f.entry.id}-${f.weight}${f.italic ? 'i' : ''}`

export function variantFor(family: string, baseWeight: number, bold: boolean, italic: boolean): Variant {
  const entry = fontEntry(family)
  const base = nearestWeight(entry, baseWeight)
  let weight = base
  let embolden = 0
  if (bold) {
    // Bold is the next real weight at least two steps heavier (and at least 700).
    const heavier = entry.weights.find((w) => w >= Math.max(700, base + 200))
    const heaviest = Math.max(...entry.weights)
    if (heavier) weight = heavier
    else if (heaviest > base) weight = heaviest
    else embolden = EMBOLDEN
  }
  if (italic && entry.italics.length) {
    const iw = nearest(entry.italics, weight)
    if (Math.abs(iw - weight) <= 100) return { entry, weight: iw, italic: true, slant: 0, embolden }
  }
  return { entry, weight, italic: false, slant: italic ? SLANT : 0, embolden }
}

/** Every font file a text layer needs. */
export function filesFor(t: Pick<TextLayer, 'family' | 'weight' | 'text' | 'spans'>): Variant[] {
  return stylesUsed(t.text.length, t.spans).map((s) => variantFor(t.family, t.weight, s.bold, s.italic))
}

/** Faces for laying out a text layer, or null while any font is still loading. */
export function facesFor(
  t: Pick<TextLayer, 'family' | 'weight' | 'text' | 'spans'>,
  get: (f: FontFile) => ShapingFont | null,
): FaceFor | null {
  const cache = new Map<string, Face>()
  for (const s of stylesUsed(t.text.length, t.spans)) {
    const v = variantFor(t.family, t.weight, s.bold, s.italic)
    const font = get(v)
    if (!font) return null
    cache.set(`${s.bold}${s.italic}`, { font, slant: v.slant, embolden: v.embolden })
  }
  return (bold, italic) => {
    const hit = cache.get(`${bold}${italic}`)
    if (hit) return hit
    // A style the text doesn't use (only asked for metrics): fall back to upright.
    return cache.get('falsefalse') ?? [...cache.values()][0]
  }
}
