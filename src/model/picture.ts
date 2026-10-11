import type { Cover, ImageLayer } from './doc'
import { bleedFrame } from './doc'
import type { Pt } from './geometry'

// Placing a picture inside its frame. Scale is relative to "fill": 100 %
// is the smallest size that still covers the whole frame.

type Content = ImageLayer['content']
type Frame = Pick<ImageLayer, 'w' | 'h'>

/** Image pixels → mm factor at which the picture exactly covers the frame. */
export const fillFactor = (iw: number, ih: number, f: Frame) => Math.max(f.w / iw, f.h / ih)

/** Current scale, 1 = fill. */
export const pictureScale = (l: ImageLayer, iw: number, ih: number) => l.content.w / (iw * fillFactor(iw, ih, l))

/** Keep a picture covering its frame: no smaller than fill, no gaps at any edge. */
export function clampToFill(c: Content, f: Frame): Content {
  let { x, y, w, h } = c
  const k = Math.max(f.w / w, f.h / h, 1)
  if (k > 1) {
    // Grow about the picture's centre until it covers.
    const cx = x + w / 2
    const cy = y + h / 2
    w *= k
    h *= k
    x = cx - w / 2
    y = cy - h / 2
  }
  x = Math.min(0, Math.max(f.w - w, x))
  y = Math.min(0, Math.max(f.h - h, y))
  return { x, y, w, h }
}

/**
 * Resize the picture to `scale` × fill, keeping the point under `anchor`
 * (frame mm; the frame's centre by default) where it is.
 */
export function scalePicture(l: ImageLayer, iw: number, ih: number, scale: number, anchor?: Pt): Content {
  const c = l.content
  const a = anchor ?? { x: l.w / 2, y: l.h / 2 }
  const k = scale * fillFactor(iw, ih, l)
  const w = iw * k
  const h = ih * k
  const u = (a.x - c.x) / c.w
  const v = (a.y - c.y) / c.h
  const next = { x: a.x - u * w, y: a.y - v * h, w, h }
  return l.fillLock ? clampToFill(next, l) : next
}

/** Picture offset from centred, in mm (positive = moved right/down). */
export const pictureShift = (l: ImageLayer): Pt => ({
  x: l.content.x + l.content.w / 2 - l.w / 2,
  y: l.content.y + l.content.h / 2 - l.h / 2,
})

export function shiftPicture(l: ImageLayer, shift: Pt): Content {
  const next = { ...l.content, x: l.w / 2 + shift.x - l.content.w / 2, y: l.h / 2 + shift.y - l.content.h / 2 }
  return l.fillLock ? clampToFill(next, l) : next
}

/** Does the frame span the cover's whole printed area, bleed included? */
export function isFullBleed(l: ImageLayer, cover: Cover) {
  const b = bleedFrame(cover)
  return l.rotation === 0 && Math.abs(l.x - b.x) + Math.abs(l.y - b.y) + Math.abs(l.w - b.w) + Math.abs(l.h - b.h) < 0.01
}
