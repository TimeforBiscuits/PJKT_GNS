import { composeSheets, type Sheet } from '../model/compose'
import type { ImageLayer } from '../model/doc'
import { PRINTERS } from '../model/imposition'
import { MM_PER_INCH } from '../model/units'
import { fileSync, fontEntry, fontSync, loadCensorFont, loadFont, loadTextFonts } from '../fonts/registry'
import { facesFor } from '../fonts/variants'
import { renderFx, type FxEnv } from '../effects/render'
import { CENSOR_FAMILY, censorFace, censorFontWeight } from '../model/censor'
import { useAssets, type Asset } from '../store/assets'
import { useDoc } from '../store/doc'
import { useEditor } from '../store/editor'
import { writeSheetsPdf, writeTestPagePdf, type PlacedImage, type WriterDeps } from './writer'

/** iPad Safari refuses canvases over 16.7 megapixels. */
const isIOS = () => navigator.maxTouchPoints > 1 && /Mac|iPad|iPhone/.test(navigator.userAgent)
const maxPixels = () => (isIOS() ? 16_000_000 : 64_000_000)

const loadImage = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('A picture could not be decoded for the PDF.'))
    img.src = url
  })

const toBytes = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Uint8Array>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error('Out of memory writing a picture.'))),
      type,
      q,
    ),
  )

/**
 * Crop a picture to the part its frame shows and resample it to the print
 * resolution — never above the pixels the original has.
 */
export async function rasterize(layer: ImageLayer, asset: Asset, dpi: number): Promise<PlacedImage | null> {
  const c = layer.content
  const vx0 = Math.max(0, c.x)
  const vx1 = Math.min(layer.w, c.x + c.w)
  const vy0 = Math.max(0, c.y)
  const vy1 = Math.min(layer.h, c.y + c.h)
  if (vx1 - vx0 < 0.01 || vy1 - vy0 < 0.01) return null

  const nx0 = (vx0 - c.x) / c.w
  const nx1 = (vx1 - c.x) / c.w
  const ny0 = (vy0 - c.y) / c.h
  const ny1 = (vy1 - c.y) / c.h
  const sx0 = (layer.flipX ? 1 - nx1 : nx0) * asset.width
  const sx1 = (layer.flipX ? 1 - nx0 : nx1) * asset.width
  const sy0 = (layer.flipY ? 1 - ny1 : ny0) * asset.height
  const sy1 = (layer.flipY ? 1 - ny0 : ny1) * asset.height
  const srcW = sx1 - sx0
  const srcH = sy1 - sy0
  const region = { x: vx0, y: vy0, w: vx1 - vx0, h: vy1 - vy0 }

  let k = Math.min(1, ((region.w / MM_PER_INCH) * dpi) / srcW)
  const px = srcW * k * srcH * k
  if (px > maxPixels()) k *= Math.sqrt(maxPixels() / px)
  const tw = Math.max(1, Math.round(srcW * k))
  const th = Math.max(1, Math.round(srcH * k))

  const img = await loadImage(asset.blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Out of memory preparing a picture.')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    if (layer.flipX) {
      ctx.translate(tw, 0)
      ctx.scale(-1, 1)
    }
    if (layer.flipY) {
      ctx.translate(0, th)
      ctx.scale(1, -1)
    }
    if (!asset.hasAlpha) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, tw, th)
    }
    ctx.drawImage(img, sx0, sy0, srcW, srcH, 0, 0, tw, th)
    const bytes = asset.hasAlpha ? await toBytes(canvas, 'image/png') : await toBytes(canvas, 'image/jpeg', 0.93)
    canvas.width = canvas.height = 0
    return { bytes, kind: asset.hasAlpha ? 'png' : 'jpg', region }
  } finally {
    URL.revokeObjectURL(img.src)
  }
}

async function browserDeps(sheets: Sheet[], dpi: number, onImage?: () => void): Promise<WriterDeps> {
  const loads: Promise<unknown>[] = [loadFont('IBM Plex Mono', 400), loadFont('Inter Tight', 800)]
  for (const s of sheets)
    for (const c of s.covers)
      for (const l of c?.layers ?? []) {
        if (l.kind === 'text' && !l.hidden) loads.push(loadTextFonts(l))
        if (l.kind === 'censor' && !l.hidden) loads.push(loadCensorFont(l.weight))
      }
  await Promise.all(loads)
  const assets = useAssets.getState().assets
  return {
    font: (family, weight, italic = false) => {
      const entry = fontEntry(family)
      const f = italic ? fileSync({ entry, weight, italic }) : fontSync(family, weight)
      if (!f) throw new Error(`Font ${family} ${weight}${italic ? ' italic' : ''} did not load.`)
      return f
    },
    image: async (layer) => {
      const asset = assets[layer.assetId]
      if (!asset) return null
      const out = await rasterize(layer, asset, dpi)
      onImage?.()
      return out
    },
    effect: async (layer) => {
      const env: FxEnv = {}
      if (layer.kind === 'text') env.faces = facesFor(layer, (f) => fileSync(f)!)
      if (layer.kind === 'censor') env.censor = censorFace(fontSync(CENSOR_FAMILY, censorFontWeight(layer.weight))!, layer.weight)
      let img: HTMLImageElement | null = null
      if (layer.kind === 'image') {
        const asset = assets[layer.assetId]
        if (!asset) return null
        img = await loadImage(asset.blob)
        env.picture = img
      }
      try {
        // Effects are pictures in the PDF, at the chosen resolution.
        const r = renderFx(layer, env, dpi / MM_PER_INCH, maxPixels())
        if (!r) return null
        const bytes = r.opaque ? await toBytes(r.canvas, 'image/jpeg', 0.93) : await toBytes(r.canvas, 'image/png')
        r.canvas.width = r.canvas.height = 0
        onImage?.()
        return { bytes, kind: r.opaque ? 'jpg' : 'png', region: r.box }
      } finally {
        if (img) URL.revokeObjectURL(img.src)
      }
    },
  }
}

export interface BuiltPdf {
  file: File
  sheets: number
}

/** Build the print PDF for everything in the queue. */
export async function buildCoversPdf(fileName: string, onProgress?: (msg: string) => void): Promise<BuiltPdf> {
  const { project } = useDoc.getState()
  const ed = useEditor.getState()
  const printer = PRINTERS[ed.printerId]
  const sheets = composeSheets(project, printer)
  if (!sheets.length) throw new Error('No sheets to print — add a sheet and put covers in its slots.')
  let pics = 0
  onProgress?.('Loading fonts')
  const deps = await browserDeps(sheets, ed.dpi, () => onProgress?.(`Pictures ${++pics}`))
  onProgress?.('Writing PDF')
  const bytes = await writeSheetsPdf(sheets, deps, {
    cutLines: ed.cutLines,
  })
  const file = new File([bytes as BlobPart], fileName, { type: 'application/pdf' })
  return { file, sheets: sheets.reduce((n, s) => n + s.spec.copies, 0) }
}

export async function buildTestPdf(): Promise<BuiltPdf> {
  const deps = await browserDeps([], 300)
  const bytes = await writeTestPagePdf(deps)
  return { file: new File([bytes as BlobPart], 'PJKT_GNS-printer-test.pdf', { type: 'application/pdf' }), sheets: 1 }
}

