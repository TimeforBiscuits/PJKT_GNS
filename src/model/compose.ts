import type { Cover, Project } from './doc'
import { FORMATS, FORMAT_IDS, type FormatId } from './formats'
import { layoutSheet, type PrinterProfile, type SheetLayout } from './imposition'

/** One printed A4 sheet: a layout and the cover printed in each of its slots. */
export interface Sheet {
  formatId: FormatId
  layout: SheetLayout
  covers: Cover[]
}

/**
 * Lay the print queue out on as few sheets as possible. Covers of the same
 * format share sheets (two Notebooks per A4); formats never mix on a sheet
 * because their layouts differ.
 */
export function composeSheets(project: Project, printer: PrinterProfile): Sheet[] {
  const sheets: Sheet[] = []
  for (const formatId of FORMAT_IDS) {
    const run: Cover[] = []
    for (const c of project.covers) {
      if (c.formatId !== formatId) continue
      const copies = Math.max(0, Math.floor(project.queue[c.id] ?? 0))
      for (let i = 0; i < copies; i++) run.push(c)
    }
    if (!run.length) continue
    const full = layoutSheet(FORMATS[formatId], { printer })
    const per = full.placements.length
    if (per === 0) continue
    for (let i = 0; i < run.length; i += per) {
      const covers = run.slice(i, i + per)
      const layout = covers.length === per ? full : layoutSheet(FORMATS[formatId], { printer, max: covers.length })
      sheets.push({ formatId, layout, covers })
    }
  }
  return sheets
}

/** Gap between sheets in the print preview, mm. */
export const SHEET_GAP = 24
