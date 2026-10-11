import { create } from 'zustand'
import type { LineCap, StrokeAlign, TextAlign } from '../model/doc'
import { CSS_PX_PER_MM } from '../model/units'

export type ToolId = 'select' | 'image' | 'rect' | 'ellipse' | 'polygon' | 'line' | 'text' | 'hand'

export type ViewId = 'cover' | 'sheet'

export interface Guides {
  bleed: boolean
  safe: boolean
  fold: boolean
  rulers: boolean
  dims: boolean
}

export interface Camera {
  /** Screen pixels per millimetre. */
  zoom: number
  /** Screen position of the world origin, in pixels. */
  x: number
  y: number
}

/** Defaults the shape and text tools will draw with. */
export interface ToolStyle {
  fill: string | null
  stroke: string | null
  strokeWidthPt: number
  strokeAlign: StrokeAlign
  fontFamily: string
  fontWeight: number
  fontSizePt: number
  leadingPt: number
  /** Letter spacing in thousandths of an em, as in InDesign. */
  tracking: number
  sides: number
  radius: number
  cap: LineCap
  textAlign: TextAlign
  uppercase: boolean
  textColor: string
}

const CALIBRATION_KEY = 'pjkt_gns.pxPerMm'

const loadCalibration = (): number | null => {
  try {
    const v = Number(localStorage.getItem(CALIBRATION_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

interface EditorState {
  view: ViewId
  tool: ToolId
  guides: Guides
  /** Hide everything outside the trim to preview the cut cover. */
  trimPreview: boolean
  camera: Camera
  /** Size of the workspace in screen pixels. */
  viewSize: { w: number; h: number }
  /** Bumped to ask the viewport to fit the scene to the screen. */
  fitRequest: number
  /** Measured screen pixels per mm; null until the user calibrates. */
  pxPerMm: number | null
  /** Pointer position in scene millimetres, for the status bar. */
  cursor: { x: number; y: number } | null
  style: ToolStyle
  calibrating: boolean
  printerId: string
  dpi: 300 | 600
  /** Set to move keyboard focus into the text box of the selected text layer. */
  textFocus: boolean
  /** When autosave last wrote the project. */
  savedAt: number | null
  /** A short status message, e.g. an import error. */
  message: { text: string; at: number; tone: 'info' | 'alert' } | null
  marks: { crop: boolean; fold: boolean }

  setView: (v: ViewId) => void
  setTool: (t: ToolId) => void
  toggleGuide: (g: keyof Guides) => void
  setTrimPreview: (on: boolean) => void
  setCamera: (c: Camera) => void
  setViewSize: (s: { w: number; h: number }) => void
  requestFit: () => void
  setCursor: (p: { x: number; y: number } | null) => void
  setStyle: (patch: Partial<ToolStyle>) => void
  setCalibrating: (on: boolean) => void
  setPxPerMm: (v: number | null) => void
  setPrinter: (id: string) => void
  setDpi: (dpi: 300 | 600) => void
  toggleMark: (m: 'crop' | 'fold') => void
  focusText: () => void
  textFocused: () => void
  flash: (text: string, tone?: 'info' | 'alert') => void
  setSavedAt: (t: number) => void
}

export const useEditor = create<EditorState>((set) => ({
  view: 'cover',
  tool: 'select',
  guides: { bleed: true, safe: true, fold: true, rulers: true, dims: true },
  trimPreview: false,
  camera: { zoom: CSS_PX_PER_MM, x: 0, y: 0 },
  viewSize: { w: 0, h: 0 },
  fitRequest: 0,
  pxPerMm: loadCalibration(),
  cursor: null,
  style: {
    fill: '#111111',
    stroke: null,
    strokeWidthPt: 6,
    strokeAlign: 'inside',
    fontFamily: 'Inter Tight',
    fontWeight: 800,
    fontSizePt: 36,
    leadingPt: 34,
    tracking: -20,
    sides: 3,
    radius: 0,
    cap: 'butt',
    textAlign: 'left',
    uppercase: false,
    textColor: '#111111',
  },
  calibrating: false,
  printerId: 'pixma',
  dpi: 600,
  marks: { crop: true, fold: true },
  textFocus: false,
  message: null,
  savedAt: null,

  setView: (view) => set((s) => ({ view, fitRequest: s.fitRequest + 1 })),
  setTool: (tool) => set({ tool }),
  toggleGuide: (g) => set((s) => ({ guides: { ...s.guides, [g]: !s.guides[g] } })),
  setTrimPreview: (trimPreview) => set({ trimPreview }),
  setCamera: (camera) => set({ camera }),
  setViewSize: (viewSize) => set({ viewSize }),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  setCursor: (cursor) => set({ cursor }),
  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setCalibrating: (calibrating) => set({ calibrating }),
  setPxPerMm: (pxPerMm) => {
    try {
      if (pxPerMm) localStorage.setItem(CALIBRATION_KEY, String(pxPerMm))
      else localStorage.removeItem(CALIBRATION_KEY)
    } catch {
      // storage unavailable (private mode): calibration lasts for this session only
    }
    set({ pxPerMm })
  },
  setPrinter: (printerId) => set({ printerId }),
  setDpi: (dpi) => set({ dpi }),
  toggleMark: (m) => set((s) => ({ marks: { ...s.marks, [m]: !s.marks[m] } })),
  focusText: () => set({ textFocus: true }),
  textFocused: () => set({ textFocus: false }),
  flash: (text, tone = 'alert') => set({ message: { text, at: Date.now(), tone } }),
  setSavedAt: (savedAt) => set({ savedAt }),
}))

/** Pixels per mm that count as 100 % — real size once calibrated. */
export const actualSizeZoom = (pxPerMm: number | null): number => pxPerMm ?? CSS_PX_PER_MM
