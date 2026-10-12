import { useMemo, type ReactNode } from 'react'
import { useCensorFace } from '../fonts/registry'
import type { CensorLayer, ImageLayer, Layer, ShapeLayer, TextLayer } from '../model/doc'
import { useFxPreview, usePicture } from '../effects/preview'
import type { FxEnv } from '../effects/render'
import { useAssets } from '../store/assets'
import { CensorArt } from './CensorArt'
import { TextPaths } from './TextArt'
import { useTextLayout } from './textLayout'

/** A layer with print effects, drawn from its effect render (its plain self until that's ready). */
export function FxArt({ layer, idp, plain }: { layer: Layer; idp: string; plain: ReactNode }) {
  if (layer.kind === 'text') return <TextFx layer={layer} />
  if (layer.kind === 'censor') return <CensorFx layer={layer} idp={idp} />
  if (layer.kind === 'image') return <ImageFx layer={layer} plain={plain} />
  return <ShapeFx layer={layer} plain={plain} />
}

function Raster({ layer, env, children }: { layer: Layer; env: FxEnv | null; children: ReactNode }) {
  const p = useFxPreview(layer, env)
  if (!p) return <>{children}</>
  return <image data-fx="" href={p.url} x={p.box.x} y={p.box.y} width={p.box.w} height={p.box.h} preserveAspectRatio="none" />
}

const SHAPE_ENV: FxEnv = {}

function ShapeFx({ layer, plain }: { layer: ShapeLayer; plain: ReactNode }) {
  return (
    <Raster layer={layer} env={SHAPE_ENV}>
      {plain}
    </Raster>
  )
}

function TextFx({ layer }: { layer: TextLayer }) {
  const { faces, layout } = useTextLayout(layer)
  const env = useMemo(() => (faces ? { faces } : null), [faces])
  return (
    <Raster layer={layer} env={env}>
      <TextPaths layer={layer} layout={layout} />
    </Raster>
  )
}

function CensorFx({ layer, idp }: { layer: CensorLayer; idp: string }) {
  const face = useCensorFace(layer.weight)
  const env = useMemo(() => (face ? { censor: face } : null), [face])
  return (
    <Raster layer={layer} env={env}>
      <CensorArt layer={layer} idp={idp} />
    </Raster>
  )
}

function ImageFx({ layer, plain }: { layer: ImageLayer; plain: ReactNode }) {
  const url = useAssets((s) => s.assets[layer.assetId]?.previewUrl)
  const img = usePicture(url)
  const env = useMemo(() => (img ? { picture: img } : null), [img])
  return (
    <Raster layer={layer} env={env}>
      {plain}
    </Raster>
  )
}
