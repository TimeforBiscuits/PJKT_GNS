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

/** Comic-print dots. On flat colour: solid dots of that colour; on pictures: a colour halftone. */
export interface BenDay {
  /** 0–100: how far the dots take over from solid colour. */
  strength: number
  /** Distance between dot centres, mm. */
  dotMm: number
}

/** Wear and weather: speckle, scuffs and eaten edges, worn through to what's beneath. */
export interface Distress {
  /** 0–100 */
  strength: number
  /** Picks the pattern of wear; Shuffle picks another. */
  seed: number
}

export interface Effects {
  benday: BenDay | null
  distress: Distress | null
}

interface LayerBase extends Frame {
  id: string
  name: string
  hidden: boolean
  locked: boolean
  /** 0–1 */
  opacity: number
  /** Print effects; absent on layers made before effects existed. */
  effects?: Effects
}

export interface ImageLayer extends LayerBase {
  kind: 'image'
  assetId: string
  /** Where the whole image sits, in the frame's own mm. The frame crops it. */
  content: { x: number; y: number; w: number; h: number }
  flipX: boolean
  flipY: boolean
  /** Keep the picture covering its whole frame while it's moved or scaled (no white gaps). */
  fillLock: boolean
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

/** A stretch of characters [start, end) set bold and/or italic. */
export interface TextSpan {
  start: number
  end: number
  bold?: boolean
  italic?: boolean
}

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
  /** Bold/italic words; sorted, non-overlapping. */
  spans: TextSpan[]
  /** The letters print no ink, whatever their colour, so the paper or card shows through. */
  knockout?: boolean
}

export type CensorWeight = 'regular' | 'medium' | 'bold'

/**
 * TOP SECRET: a dark stripe that is also one line of type. The type is sized
 * by the stripe's thickness (h), so drawing it thicker sets it bigger; type
 * running past the ends is cut off, like a real censor bar.
 */
export interface CensorLayer extends LayerBase {
  kind: 'censor'
  text: string
  weight: CensorWeight
  /** Gap between the capitals and the stripe's long edges, in points. */
  insetPt: number
  /** Thousandths of an em added between letters. */
  tracking: number
  align: TextAlign
  uppercase: boolean
  /** The stripe. */
  fill: string
  /** The letters. */
  color: string
  /** The letters print no ink, whatever their colour, so the paper or card shows through. */
  knockout?: boolean
}

export type Layer = ImageLayer | ShapeLayer | TextLayer | CensorLayer
export type LayerKind = Layer['kind']

export interface Cover {
  id: string
  name: string
  formatId: FormatId
  /** Paper colour under everything, running into the bleed. */
  background: string
  /** The paper colour is the card printed on: shown on screen, never printed. */
  card?: boolean
  /** Bottom to top. */
  layers: Layer[]
}

/** One printed A4 layout: which cover goes in each slot, and how many to print. */
export interface SheetSpec {
  id: string
  formatId: FormatId
  /** Cover id per slot (top to bottom); null leaves the slot blank. */
  slots: (string | null)[]
  copies: number
}

export interface Project {
  covers: Cover[]
  sheets: SheetSpec[]
  /** Name for exported files (PDF and .gns); empty means a dated default. */
  name?: string
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

/**
 * Pure white: printers have no white ink, so this is where they print nothing
 * and the paper shows. Knockout letters are set in it.
 */
export const NO_INK = '#ffffff'

/** The colour a text layer's or stripe's letters print in. */
export const letterColor = (l: TextLayer | CensorLayer) => (l.knockout ? NO_INK : l.color)

export const hasEffects = (l: { effects?: Effects }) => !!(l.effects && (l.effects.benday || l.effects.distress))

export const layerLabel: Record<LayerKind, string> = { image: 'Image', shape: 'Shape', text: 'Text', censor: 'Top secret' }
