import type { Cover, Project, SheetSpec } from './doc'
import { FORMATS, FORMAT_IDS, type FormatId } from './formats'
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
    out.push({ spec, formatId: spec.formatId, layout, covers, cuts: cutLines(layout, covers.map(Boolean)) })
  }
  return out
}

/** Blank cut templates: a page per format with every slot's cut lines and nothing printed. */
export function blankSheets(printer: PrinterProfile, formats: readonly FormatId[] = FORMAT_IDS): Sheet[] {
  return formats.map((formatId) => {
    const layout = layoutSheet(FORMATS[formatId], { printer })
    const blank = layout.placements.map(() => null)
    return {
      spec: { id: `blank-${formatId}`, formatId, slots: blank, copies: 1 },
      formatId,
      layout,
      covers: blank,
      cuts: cutLines(layout, layout.placements.map(() => true)),
    }
  })
}

/** Gap between sheets in the print preview, mm. */
export const SHEET_GAP = 24
