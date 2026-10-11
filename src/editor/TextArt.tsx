import type { TextLayer } from '../model/doc'

/** Text layers — outlines arrive with the type build. */
export function TextArt({ layer }: { layer: TextLayer }) {
  return <rect width={layer.w} height={Math.max(layer.h, 1)} fill="none" stroke="#ff2a8a" strokeWidth={0.2} strokeDasharray="1 1" />
}
