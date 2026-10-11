import { bleedFrame, uid, type Cover, type ImageLayer } from '../model/doc'
import { useAssets, type Asset } from '../store/assets'

/** Longest side of the on-screen copy. Big enough for 1:1 on a Retina iPad. */
const PREVIEW_MAX = 2560

export class ImportError extends Error {}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImportError('This browser can’t read that file as an image.'))
    img.src = url
  })

const canvasBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new ImportError('Could not prepare a preview.'))), type, q),
  )

/** Read a file into an asset: original kept, EXIF-oriented size, screen preview. */
export async function readImage(file: File): Promise<Asset> {
  const url = URL.createObjectURL(file)
  try {
    // <img> applies EXIF orientation, so natural size is the size as seen.
    const img = await loadImage(url)
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (!width || !height) throw new ImportError('That image has no size.')

    const k = Math.min(1, PREVIEW_MAX / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * k))
    canvas.height = Math.max(1, Math.round(height * k))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new ImportError('Out of memory preparing the preview.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    let hasAlpha = false
    if (!/jpe?g/i.test(file.type)) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4 * 7) {
        if (data[i] < 255) {
          hasAlpha = true
          break
        }
      }
    }
    const preview = await canvasBlob(canvas, hasAlpha ? 'image/png' : 'image/jpeg', 0.9)
    canvas.width = canvas.height = 0
    return {
      id: uid('as'),
      name: file.name.replace(/\.[^.]+$/, '') || 'Image',
      blob: file,
      width,
      height,
      hasAlpha,
      previewUrl: URL.createObjectURL(preview),
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Scale and centre content so it covers (fill) or fits inside (fit) a w × h box. */
export const placeContent = (iw: number, ih: number, w: number, h: number, mode: 'fill' | 'fit') => {
  const k = mode === 'fill' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  const cw = iw * k
  const ch = ih * k
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch }
}

/** A new full-bleed image layer for the cover, filling the frame. */
export const fullBleedLayer = (cover: Cover, asset: Asset): ImageLayer => {
  const f = bleedFrame(cover)
  return {
    id: uid('ly'),
    kind: 'image',
    name: asset.name,
    hidden: false,
    locked: false,
    opacity: 1,
    ...f,
    assetId: asset.id,
    content: placeContent(asset.width, asset.height, f.w, f.h, 'fill'),
    flipX: false,
    flipY: false,
  }
}

export async function importFiles(files: Iterable<File>): Promise<Asset[]> {
  const out: Asset[] = []
  for (const f of files) {
    if (!f.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|heif|tiff?|avif|bmp)$/i.test(f.name)) continue
    const a = await readImage(f)
    useAssets.getState().add(a)
    out.push(a)
  }
  return out
}

/** Effective print resolution of an image layer, in pixels per inch. */
export const layerPpi = (layer: ImageLayer, asset: Asset) =>
  Math.min((asset.width * 25.4) / layer.content.w, (asset.height * 25.4) / layer.content.h)
