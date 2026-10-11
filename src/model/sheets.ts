import type { Cover, Frame, ImageLayer, Project, SheetSpec, TextLayer } from './doc'
import { uid } from './doc'
import { FORMATS, FORMAT_IDS, type FormatId } from './formats'
import { DEFAULT_PRINTER, coversPerSheet } from './imposition'

// Keeping the print sheets in step with the covers.

export const slotsFor = (formatId: FormatId) => coversPerSheet(FORMATS[formatId], DEFAULT_PRINTER)

export const newSheet = (formatId: FormatId, fill: string | null = null): SheetSpec => ({
  id: uid('sh'),
  formatId,
  slots: Array.from({ length: slotsFor(formatId) }, () => fill),
  copies: 1,
})

/** Put a new cover in the first free slot of its format, or on a sheet of its own. */
export function placeCover(sheets: SheetSpec[], cover: Cover): SheetSpec[] {
  const i = sheets.findIndex((s) => s.formatId === cover.formatId && s.slots.includes(null))
  if (i < 0) return [...sheets, newSheet(cover.formatId, cover.id)]
  return sheets.map((s, j) => (j === i ? { ...s, slots: s.slots.map((x, k) => (k === s.slots.indexOf(null) ? cover.id : x)) } : s))
}

/** Blank out a cover's slots; sheets left with nothing on them go. */
export function dropCover(sheets: SheetSpec[], coverId: string, keepFormat?: FormatId): SheetSpec[] {
  return sheets
    .map((s) => (s.formatId === keepFormat ? s : { ...s, slots: s.slots.map((x) => (x === coverId ? null : x)) }))
    .filter((s) => s.slots.some((x) => x !== null))
}

/** After a cover changes format, move it to sheets of the new format. */
export function refileCover(sheets: SheetSpec[], cover: Cover): SheetSpec[] {
  const kept = dropCover(sheets, cover.id, cover.formatId)
  return kept.some((s) => s.formatId === cover.formatId && s.slots.includes(cover.id)) ? kept : [...kept, newSheet(cover.formatId, cover.id)]
}

const coversFrame = (l: Frame & Pick<ImageLayer, 'content'>) =>
  l.content.x <= 1e-6 && l.content.y <= 1e-6 && l.content.x + l.content.w >= l.w - 1e-6 && l.content.y + l.content.h >= l.h - 1e-6

/**
 * Bring a project saved by an older version up to date: the copies queue
 * becomes explicit sheets, pictures that fill their frame keep doing so.
 */
export function migrateProject(raw: Project & { queue?: Record<string, number> }): Project {
  const covers = raw.covers.map((c) => ({
    ...c,
    layers: c.layers.map((l) => {
      if (l.kind === 'image' && (l as ImageLayer).fillLock === undefined) return { ...l, fillLock: coversFrame(l) }
      if (l.kind === 'text' && !(l as TextLayer).spans) return { ...l, spans: [] }
      return l
    }),
  }))
  const name = typeof raw.name === 'string' ? raw.name : ''
  if (Array.isArray(raw.sheets)) return { covers, sheets: raw.sheets, name }
  const sheets: SheetSpec[] = []
  for (const formatId of FORMAT_IDS) {
    const run: string[] = []
    for (const c of covers) if (c.formatId === formatId) for (let i = 0; i < (raw.queue?.[c.id] ?? 0); i++) run.push(c.id)
    const n = slotsFor(formatId)
    for (let i = 0; i < run.length; i += n) {
      const slots = Array.from({ length: n }, (_, k) => run[i + k] ?? null)
      const prev = sheets[sheets.length - 1]
      if (prev && prev.formatId === formatId && prev.slots.join() === slots.join()) prev.copies++
      else sheets.push({ id: uid('sh'), formatId, slots, copies: 1 })
    }
  }
  return { covers, sheets, name }
}

export const pageCount = (p: Project) => p.sheets.reduce((n, s) => n + (s.slots.some(Boolean) ? s.copies : 0), 0)
