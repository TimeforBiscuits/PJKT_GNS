import { useMemo } from 'react'
import { composeSheets } from '../model/compose'
import { bleedFrame } from '../model/doc'
import { FORMATS } from '../model/formats'
import { PRINTERS, layoutSheet } from '../model/imposition'
import { A4, type Rect } from '../model/units'
import { useActiveCover, useDoc } from '../store/doc'
import { useEditor } from '../store/editor'
import type { FitPad } from './Viewport'

export const COVER_FIT_PAD: FitPad = { t: 92, r: 28, b: 56, l: 60 }
export const SHEET_FIT_PAD: FitPad = { t: 64, r: 28, b: 56, l: 72 }
export const SHEET_FIT_BOUNDS: Rect = { x: 0, y: 0, w: A4.w, h: A4.h }

export const useCoverFitBounds = (): Rect => {
  const cover = useActiveCover()
  const { x, y, w, h } = bleedFrame(cover)
  return useMemo(() => ({ x, y, w, h }), [x, y, w, h])
}

/** The A4 imposition for the open cover's format and the chosen printer. */
export const useSheetLayout = () => {
  const formatId = useActiveCover().formatId
  const printerId = useEditor((s) => s.printerId)
  return useMemo(() => layoutSheet(FORMATS[formatId], { printer: PRINTERS[printerId] }), [formatId, printerId])
}

/** Every sheet the print queue needs. */
export const useSheets = () => {
  const project = useDoc((s) => s.project)
  const printerId = useEditor((s) => s.printerId)
  return useMemo(() => composeSheets(project, PRINTERS[printerId]), [project, printerId])
}
