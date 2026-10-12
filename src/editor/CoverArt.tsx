import { memo } from 'react'
import { bleedFrame, type Cover, type ImageLayer, type Layer, type ShapeLayer, type TextLayer } from '../model/doc'
import { frameMatrix, svgMatrix } from '../model/geometry'
import { isClosed, shapePath, toSvgD } from '../model/path'
import { ptToMm } from '../model/units'
import { useAssets } from '../store/assets'
import { CensorArt } from './CensorArt'
import { flipMatrix } from './draw'
import { TextArt } from './TextArt'

/**
 * Everything printed on a cover, drawn in cover millimetres (origin at the
 * trim's top-left corner, bleed at negative coordinates). Used by the
 * editor, the sheet preview and thumbnails, so they always agree.
 *
 * `idp` keeps clip-path ids unique when the same cover is drawn twice.
 */
export const CoverArt = memo(function CoverArt({ cover, idp }: { cover: Cover; idp: string }) {
  const b = bleedFrame(cover)
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={cover.background} />
      {cover.layers.map((l) => (l.hidden ? null : <LayerArt key={l.id} layer={l} idp={idp} />))}
    </g>
  )
})

export const LayerArt = memo(function LayerArt({ layer, idp }: { layer: Layer; idp: string }) {
  const t = svgMatrix(frameMatrix(layer))
  return (
    <g transform={t} opacity={layer.opacity < 1 ? layer.opacity : undefined}>
      {layer.kind === 'image' && <ImageArt layer={layer} idp={idp} />}
      {layer.kind === 'shape' && <ShapeArt layer={layer} idp={idp} />}
      {layer.kind === 'text' && <TextArt layer={layer as TextLayer} />}
      {layer.kind === 'censor' && <CensorArt layer={layer} idp={idp} />}
    </g>
  )
})

function ImageArt({ layer, idp }: { layer: ImageLayer; idp: string }) {
  const asset = useAssets((s) => s.assets[layer.assetId])
  const clip = `${idp}-clip-${layer.id}`
  const c = layer.content
  return (
    <>
      <clipPath id={clip}>
        <rect x={0} y={0} width={layer.w} height={layer.h} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {asset ? (
          <image
            href={asset.previewUrl}
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.h}
            preserveAspectRatio="none"
            transform={flipMatrix(layer)}
          />
        ) : (
          <MissingImage w={layer.w} h={layer.h} />
        )}
      </g>
    </>
  )
}

function MissingImage({ w, h }: { w: number; h: number }) {
  return (
    <g>
      <rect width={w} height={h} fill="#d9d4ca" />
      <path d={`M0 0L${w} ${h}M${w} 0L0 ${h}`} stroke="#8f8a7f" strokeWidth={0.4} />
    </g>
  )
}

function ShapeArt({ layer, idp }: { layer: ShapeLayer; idp: string }) {
  const path = shapePath(layer)
  const d = toSvgD(path)
  const closed = isClosed(path)
  const sw = ptToMm(layer.strokeWidthPt)
  const stroke = layer.stroke && sw > 0 ? layer.stroke : null
  const align = closed ? layer.strokeAlign : 'center'
  const common = {
    fill: 'none',
    stroke: stroke ?? undefined,
    strokeLinecap: layer.cap,
    strokeLinejoin: 'miter' as const,
    strokeMiterlimit: 10,
  }
  const id = `${idp}-sk-${layer.id}`
  const pad = sw * 2 + 1
  return (
    <>
      {layer.fill && closed && <path d={d} fill={layer.fill} />}
      {stroke && align === 'center' && <path d={d} {...common} strokeWidth={sw} />}
      {stroke && align === 'inside' && (
        <>
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
          <path d={d} {...common} strokeWidth={sw * 2} clipPath={`url(#${id})`} />
        </>
      )}
      {stroke && align === 'outside' && (
        <>
          <mask id={id} maskUnits="userSpaceOnUse" x={-pad} y={-pad} width={layer.w + 2 * pad} height={layer.h + 2 * pad}>
            <rect x={-pad} y={-pad} width={layer.w + 2 * pad} height={layer.h + 2 * pad} fill="#fff" />
            <path d={d} fill="#000" />
          </mask>
          <path d={d} {...common} strokeWidth={sw * 2} mask={`url(#${id})`} />
        </>
      )}
    </>
  )
}
