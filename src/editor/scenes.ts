import { useMemo } from 'react'
import { FORMATS, bleedRect, type FormatId } from '../model/formats'
import { PRINTERS, layoutSheet } from '../model/imposition'
import { A4, type Rect } from '../model/units'
import { useEditor } from '../store/editor'
import type { FitPad } from './Viewport'

export const COVER_FIT_PAD: FitPad = { t: 92, r: 28, b: 56, l: 60 }
export const coverFitBounds = (formatId: FormatId): Rect => bleedRect(FORMATS[formatId])

export const SHEET_FIT_PAD: FitPad = { t: 64, r: 28, b: 56, l: 72 }
export const SHEET_FIT_BOUNDS: Rect = { x: 0, y: 0, w: A4.w, h: A4.h }

/** The A4 imposition for the current format and printer. */
export const useSheetLayout = () => {
  const formatId = useEditor((s) => s.formatId)
  const printerId = useEditor((s) => s.printerId)
  return useMemo(() => layoutSheet(FORMATS[formatId], { printer: PRINTERS[printerId] }), [formatId, printerId])
}
