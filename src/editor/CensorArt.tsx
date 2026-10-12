import { useMemo } from 'react'
import { useCensorFace } from '../fonts/registry'
import { layoutCensor } from '../model/censor'
import { letterColor, type CensorLayer } from '../model/doc'
import { toSvgD } from '../model/path'

/** A TOP SECRET stripe: the bar, and its line of type cut off at the ends. */
export function CensorArt({ layer, idp }: { layer: CensorLayer; idp: string }) {
  const face = useCensorFace(layer.weight)
  const { text, w, h, insetPt, tracking, align, uppercase } = layer
  const layout = useMemo(
    () => (face ? layoutCensor(face, { text, w, h, insetPt, tracking, align, uppercase }) : null),
    [face, text, w, h, insetPt, tracking, align, uppercase],
  )
  const clip = `${idp}-cz-${layer.id}`
  const ink = letterColor(layer)
  return (
    <>
      <rect width={w} height={h} fill={layer.fill} />
      {layout && layout.path.length > 0 && (
        <>
          <clipPath id={clip}>
            <rect width={w} height={h} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <path d={toSvgD(layout.path)} fill={ink} />
            {layout.stroke && (
              <path d={toSvgD(layout.stroke.path)} fill="none" stroke={ink} strokeWidth={layout.stroke.width} strokeLinejoin="round" />
            )}
          </g>
        </>
      )}
    </>
  )
}
