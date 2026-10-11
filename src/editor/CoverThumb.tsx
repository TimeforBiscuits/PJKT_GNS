import { bleedFrame, type Cover } from '../model/doc'
import { BLEED_MM } from '../model/formats'
import { CoverArt } from './CoverArt'

/** A small rendering of a cover, bleed included, with the fold marked. */
export function CoverThumb({ cover, height }: { cover: Cover; height: number }) {
  const b = bleedFrame(cover)
  const fold = (b.w - 2 * BLEED_MM) / 2
  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      height={height}
      width={(height * b.w) / b.h}
      style={{ display: 'block', background: '#fff' }}
      aria-hidden="true"
    >
      <CoverArt cover={cover} idp={`th-${cover.id}`} />
      <path d={`M${fold} ${b.y}V${b.y + b.h}`} stroke="#000" strokeOpacity={0.35} strokeWidth={0.6} strokeDasharray="1.2 1.6" />
    </svg>
  )
}
