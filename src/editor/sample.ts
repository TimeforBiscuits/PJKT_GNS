import { uid, type Cover, type Layer, type ShapeLayer, type TextLayer } from '../model/doc'
import { BLEED_MM, FORMATS } from '../model/formats'
import { mmToPt } from '../model/units'

const base = { hidden: false, locked: false, opacity: 1, rotation: 0 }

const rect = (name: string, x: number, y: number, w: number, h: number, fill: string): ShapeLayer => ({
  ...base,
  id: uid('ly'),
  kind: 'shape',
  name,
  x,
  y,
  w,
  h,
  shape: 'rect',
  sides: 4,
  radius: 0,
  fill,
  stroke: null,
  strokeWidthPt: 0,
  strokeAlign: 'inside',
  cap: 'butt',
})

const text = (name: string, x: number, y: number, w: number, t: Partial<TextLayer>): TextLayer => ({
  ...base,
  id: uid('ly'),
  kind: 'text',
  name,
  x,
  y,
  w,
  h: 10,
  text: '',
  family: 'Inter Tight',
  weight: 800,
  sizePt: 12,
  leadingPt: 12,
  tracking: 0,
  align: 'left',
  color: '#111111',
  uppercase: false,
  spans: [],
  ...t,
})

/** A clean, bold starting layout — every piece an ordinary, editable layer. */
export function sampleLayers(cover: Cover): Layer[] {
  const { w: W, h: H } = FORMATS[cover.formatId].trim
  const pw = W / 2
  const b = BLEED_MM
  const m = 7
  const big = Math.min(mmToPt(pw * 0.3), 110)
  return [
    rect('Front field', pw, -b, pw + b, H + 2 * b, '#111111'),
    rect('Signal rule', pw, H * 0.56, pw + b, 4.2, '#ff4f00'),
    text('Title', pw + m, H * 0.56 - big * 0.32, pw - 2 * m, {
      text: 'GNS',
      family: 'Archivo',
      weight: 900,
      sizePt: big,
      leadingPt: big,
      tracking: -30,
      color: '#ffffff',
    }),
    text('Edition', pw + m, m, pw - 2 * m, { text: 'PJKT — 01', weight: 700, sizePt: 9, leadingPt: 11, tracking: 120, color: '#ffffff' }),
    text('Footer', pw + m, H - m - 5, pw - 2 * m, {
      text: `${FORMATS[cover.formatId].name} / Milano`,
      family: 'IBM Plex Mono',
      weight: 500,
      sizePt: 7,
      leadingPt: 9,
      tracking: 40,
      uppercase: true,
      color: '#8f8a7f',
    }),
    rect('Back rule', -b, H - 26, pw * 0.72 + b, 2.4, '#111111'),
    text('Name', m, H - 22, pw - 2 * m, { text: 'Project Gans', sizePt: 13, leadingPt: 14, tracking: -10 }),
    text('Spec', m, H - m - 5, pw - 2 * m, {
      text: `${W} × ${H} — fold at ${pw}`,
      family: 'IBM Plex Mono',
      weight: 400,
      sizePt: 6.5,
      leadingPt: 8,
      tracking: 30,
      color: '#6b665c',
    }),
    {
      ...rect('Ring', pw - m - 14, m, 14, 14, '#111111'),
      shape: 'ellipse',
      fill: null,
      stroke: '#111111',
      strokeWidthPt: 4.5,
    },
  ]
}
