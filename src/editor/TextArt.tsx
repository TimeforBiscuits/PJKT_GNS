import { letterColor, type TextLayer } from '../model/doc'
import { toSvgD } from '../model/path'
import type { TextLayout } from '../model/text'
import { useTextLayout } from './textLayout'

/** A text layer as outlines, set by the same engine that writes the PDF. */
export function TextArt({ layer }: { layer: TextLayer }) {
  const { layout } = useTextLayout(layer)
  return <TextPaths layer={layer} layout={layout} />
}

export function TextPaths({ layer, layout }: { layer: TextLayer; layout: TextLayout | null }) {
  const ink = letterColor(layer)
  if (!layout) return <rect width={layer.w} height={layer.h} fill={ink} opacity={0.08} />
  return (
    <>
      <path d={toSvgD(layout.path)} fill={ink} />
      {layout.stroke && (
        <path d={toSvgD(layout.stroke.path)} fill="none" stroke={ink} strokeWidth={layout.stroke.width} strokeLinejoin="round" />
      )}
    </>
  )
}
