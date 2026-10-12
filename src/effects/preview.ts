import { useEffect, useState } from 'react'
import type { Layer } from '../model/doc'
import type { Box } from '../model/geometry'
import { fxKey } from './key'
import { fxBox, renderFx, type FxEnv } from './render'

// Screen previews of layers with effects: rendered at up to 10 px/mm (about
// 2 megapixels at most), kept as PNG object URLs and shared by the editor,
// the sheet view and the thumbnails.

export interface FxPreview {
  url: string
  box: Box
}

const LIMIT = 24
const cache = new Map<string, Promise<FxPreview | null>>()

const previewK = (l: Layer) => {
  const b = fxBox(l)
  return Math.min(10, Math.sqrt(2_000_000 / Math.max(1, b.w * b.h)))
}

function previewFor(key: string, l: Layer, env: FxEnv): Promise<FxPreview | null> {
  const hit = cache.get(key)
  if (hit) {
    // most recently used goes to the back
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const p = (async () => {
    const r = renderFx(l, env, previewK(l), 4_000_000)
    if (!r) return null
    const blob = await new Promise<Blob | null>((res) => r.canvas.toBlob(res, 'image/png'))
    r.canvas.width = r.canvas.height = 0
    return blob ? { url: URL.createObjectURL(blob), box: r.box } : null
  })().catch(() => null)
  cache.set(key, p)
  while (cache.size > LIMIT) {
    const [old, q] = cache.entries().next().value!
    cache.delete(old)
    void q.then((v) => v && setTimeout(() => URL.revokeObjectURL(v.url), 5000))
  }
  return p
}

/** The effect preview for a layer, once ready (the previous one stays up while a new one renders). */
export function useFxPreview(l: Layer, env: FxEnv | null): FxPreview | null {
  const key = env ? fxKey(l) : null
  const [shown, setShown] = useState<FxPreview | null>(null)
  useEffect(() => {
    if (!key || !env) return
    let live = true
    // Wait for a pause while a slider or handle is moving.
    const t = setTimeout(
      () => {
        void previewFor(key, l, env).then((p) => {
          if (live && p) setShown(p)
        })
      },
      cache.has(key) ? 0 : 60,
    )
    return () => {
      live = false
      clearTimeout(t)
    }
    // The key already holds everything about the layer that the render uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, env])
  return shown
}

const pictures = new Map<string, Promise<HTMLImageElement>>()

/** A decoded picture for drawing onto canvases. */
export function usePicture(url: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<{ url: string; img: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!url) return
    let live = true
    let p = pictures.get(url)
    if (!p) {
      p = new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = url
      })
      pictures.set(url, p)
      p.catch(() => pictures.delete(url))
    }
    p.then((i) => live && setImg({ url, img: i })).catch(() => undefined)
    return () => {
      live = false
    }
  }, [url])
  return img && img.url === url ? img.img : null
}
