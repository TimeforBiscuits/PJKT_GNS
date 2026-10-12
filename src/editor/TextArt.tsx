import type { TextLayer } from '../model/doc'
import { toSvgD } from '../model/path'
import type { TextLayout } from '../model/text'
import { useTextLayout } from './textLayout'

/** A text layer as outlines, set by the same engine that writes the PDF. */
export function TextArt({ layer }: { layer: TextLayer }) {
  const { layout } = useTextLayout(layer)
  return <TextPaths layer={layer} layout={layout} />
}

export function TextPaths({ layer, layout }: { layer: TextLayer; layout: TextLayout | null }) {
  if (!layout) return <rect width={layer.w} height={layer.h} fill={layer.color} opacity={0.08} />
  return (
    <>
      <path d={toSvgD(layout.path)} fill={layer.color} />
      {layout.stroke && (
        <path d={toSvgD(layout.stroke.path)} fill="none" stroke={layer.color} strokeWidth={layout.stroke.width} strokeLinejoin="round" />
      )}
    </>
  )
}
