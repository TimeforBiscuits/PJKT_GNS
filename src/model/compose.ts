import type { Cover, Project, SheetSpec } from './doc'
import { FORMATS, type FormatId } from './formats'
import { cutLines, layoutSheet, type CutLine, type PrinterProfile, type SheetLayout } from './imposition'

/** One A4 layout ready to print: the covers in its slots (blank slots are null). */
export interface Sheet {
  spec: SheetSpec
  formatId: FormatId
  layout: SheetLayout
  covers: (Cover | null)[]
  cuts: CutLine[]
}

/** Resolve the project's sheets against the printer. Empty sheets are left out. */
export function composeSheets(project: Project, printer: PrinterProfile): Sheet[] {
  const byId = new Map(project.covers.map((c) => [c.id, c]))
  const out: Sheet[] = []
  for (const spec of project.sheets) {
    if (spec.copies < 1) continue
    const layout = layoutSheet(FORMATS[spec.formatId], { printer })
    const covers = layout.placements.map((_, i) => {
      const c = byId.get(spec.slots[i] ?? '')
      return c && c.formatId === spec.formatId ? c : null
    })
    if (!covers.some(Boolean)) continue
    const filled = covers.map(Boolean)
    // Marks for blank slots, and marks that would sit on a cover's bleed, aren't printed.
    const marks = layout.marks.filter((m) => filled[m.slot] && !m.inBleed)
    out.push({ spec, formatId: spec.formatId, layout: { ...layout, marks }, covers, cuts: cutLines(layout, filled) })
  }
  return out
}

/** Gap between sheets in the print preview, mm. */
export const SHEET_GAP = 24
