import { BLEED_MM, FORMATS, type FormatId } from './formats'

// The document: a project holds several cover designs; each cover is a stack
// of layers drawn in cover millimetres (origin at the trim's top-left corner,
// bleed at negative coordinates).

export type StrokeAlign = 'inside' | 'center' | 'outside'
export type LineCap = 'butt' | 'round' | 'square'

/** A rotated box. Rotation (degrees, clockwise) turns about the box centre. */
export interface Frame {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

interface LayerBase extends Frame {
  id: string
  name: string
  hidden: boolean
  locked: boolean
  /** 0–1 */
  opacity: number
}

export interface ImageLayer extends LayerBase {
  kind: 'image'
  assetId: string
  /** Where the whole image sits, in the frame's own mm. The frame crops it. */
  content: { x: number; y: number; w: number; h: number }
  flipX: boolean
  flipY: boolean
}

export type ShapeKind = 'rect' | 'ellipse' | 'polygon' | 'line'

export interface ShapeLayer extends LayerBase {
  kind: 'shape'
  shape: ShapeKind
  /** Polygon corners. */
  sides: number
  /** Rectangle corner radius, mm. */
  radius: number
  fill: string | null
  stroke: string | null
  strokeWidthPt: number
  strokeAlign: StrokeAlign
  cap: LineCap
}

export type TextAlign = 'left' | 'center' | 'right'

export interface TextLayer extends LayerBase {
  kind: 'text'
  text: string
  family: string
  weight: number
  sizePt: number
  leadingPt: number
  /** Thousandths of an em added between letters. */
  tracking: number
  align: TextAlign
  color: string
  uppercase: boolean
}

export type Layer = ImageLayer | ShapeLayer | TextLayer
export type LayerKind = Layer['kind']

export interface Cover {
  id: string
  name: string
  formatId: FormatId
  /** Paper colour under everything, running into the bleed. */
  background: string
  /** Bottom to top. */
  layers: Layer[]
}

export interface Project {
  covers: Cover[]
  /** Copies of each cover to print, by cover id. */
  queue: Record<string, number>
}

let counter = 0
export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const newCover = (formatId: FormatId, n: number): Cover => ({
  id: uid('cv'),
  name: `Cover ${String(n).padStart(2, '0')}`,
  formatId,
  background: '#ffffff',
  layers: [],
})

export const coverSize = (c: Cover) => FORMATS[c.formatId].trim

/** The whole printed area of a cover, bleed included. */
export const bleedFrame = (c: Cover): Frame => {
  const t = coverSize(c)
  return { x: -BLEED_MM, y: -BLEED_MM, w: t.w + 2 * BLEED_MM, h: t.h + 2 * BLEED_MM, rotation: 0 }
}

export const layerLabel: Record<LayerKind, string> = { image: 'Image', shape: 'Shape', text: 'Text' }
