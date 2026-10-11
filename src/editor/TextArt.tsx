import { useEffect, useMemo } from 'react'
import { useFont } from '../fonts/registry'
import type { TextLayer } from '../model/doc'
import { toSvgD } from '../model/path'
import { layoutText } from '../model/text'
import { useDoc } from '../store/doc'

/** A text layer as outlines, set by the same engine that writes the PDF. */
export function TextArt({ layer }: { layer: TextLayer }) {
  const font = useFont(layer.family, layer.weight)
  const { text, sizePt, leadingPt, tracking, align, uppercase, w } = layer
  const layout = useMemo(
    () => (font ? layoutText(font, { text, sizePt, leadingPt, tracking, align, uppercase, w }) : null),
    [font, text, sizePt, leadingPt, tracking, align, uppercase, w],
  )
  const syncTextHeight = useDoc((s) => s.syncTextHeight)
  useEffect(() => {
    if (layout) syncTextHeight(layer.id, layout.height)
  }, [layout, layer.id, syncTextHeight])

  if (!layout) return <rect width={layer.w} height={layer.h} fill={layer.color} opacity={0.08} />
  return <path d={toSvgD(layout.path)} fill={layer.color} />
}
