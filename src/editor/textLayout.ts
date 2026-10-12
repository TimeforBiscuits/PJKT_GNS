import { useEffect, useMemo } from 'react'
import { useFaces } from '../fonts/registry'
import type { TextLayer } from '../model/doc'
import { layoutText } from '../model/text'
import { useDoc } from '../store/doc'

/** Lay out a text layer (keeping its frame's height in step with its lines). */
export function useTextLayout(layer: TextLayer) {
  const faces = useFaces(layer)
  const { text, spans, sizePt, leadingPt, tracking, align, uppercase, w } = layer
  const layout = useMemo(
    () => (faces ? layoutText(faces, { text, spans, sizePt, leadingPt, tracking, align, uppercase, w }) : null),
    [faces, text, spans, sizePt, leadingPt, tracking, align, uppercase, w],
  )
  const syncTextHeight = useDoc((s) => s.syncTextHeight)
  useEffect(() => {
    if (layout) syncTextHeight(layer.id, layout.height)
  }, [layout, layer.id, syncTextHeight])
  return { faces, layout }
}
