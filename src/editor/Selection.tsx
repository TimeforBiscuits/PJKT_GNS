import type { ImageLayer } from '../model/doc'
import { apply, frameMatrix, svgMatrix } from '../model/geometry'
import { useAssets } from '../store/assets'
import { useDoc, useSelectedLayer } from '../store/doc'
import type { Camera } from '../store/editor'
import { flipMatrix, ppiColor } from './draw'
import { handlesFor, toScreen } from './hit'
import { layerPpi } from './importImage'
import { useOverlay } from './interact'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const HS = coarse ? 14 : 10

/** The whole picture, faintly, while you reposition it inside its frame. Drawn in cover mm. */
export function ContentGhost() {
  const layer = useSelectedLayer()
  const contentEdit = useDoc((s) => s.contentEdit)
  const asset = useAssets((s) => (layer?.kind === 'image' ? s.assets[layer.assetId] : undefined))
  const ghost = useOverlay((s) => s.ghost)
  if (!layer || layer.kind !== 'image' || !(contentEdit || ghost) || !asset) return null
  const c = layer.content
  return (
    <g transform={svgMatrix(frameMatrix(layer))} opacity={0.38} pointerEvents="none">
      <image href={asset.previewUrl} x={c.x} y={c.y} width={c.w} height={c.h} preserveAspectRatio="none" transform={flipMatrix(layer)} />
    </g>
  )
}

/** Selection outline, handles, snap guides and the resolution badge, in screen space. */
export function SelectionOverlay({ cam, size }: { cam: Camera; size: { w: number; h: number } }) {
  const layer = useSelectedLayer()
  const contentEdit = useDoc((s) => s.contentEdit)
  const guides = useOverlay((s) => s.guides)
  const asset = useAssets((s) => (layer?.kind === 'image' ? s.assets[layer.assetId] : undefined))

  const guideEls = guides.map((g, i) => {
    const v = g.axis === 'x' ? Math.round(cam.x + g.at * cam.zoom) + 0.5 : Math.round(cam.y + g.at * cam.zoom) + 0.5
    return (
      <path
        key={i}
        d={g.axis === 'x' ? `M${v} 0V${size.h}` : `M0 ${v}H${size.w}`}
        stroke="var(--signal)"
        strokeWidth={1}
        strokeDasharray="5 3"
      />
    )
  })

  if (!layer) return <g pointerEvents="none">{guideEls}</g>

  const m = frameMatrix(layer)
  const poly = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z'
  const corners = [
    { x: 0, y: 0 },
    { x: layer.w, y: 0 },
    { x: layer.w, y: layer.h },
    { x: 0, y: layer.h },
  ].map((p) => toScreen(cam, apply(m, p)))
  const isLine = layer.kind === 'shape' && layer.shape === 'line'
  const handles = layer.locked ? [] : handlesFor(layer, cam)
  const rot = handles.find((h) => h.id === 'rot')
  const topMid = toScreen(cam, apply(m, { x: layer.w / 2, y: 0 }))

  let content: React.ReactNode = null
  if (layer.kind === 'image' && contentEdit) {
    const c = (layer as ImageLayer).content
    const cc = [
      { x: c.x, y: c.y },
      { x: c.x + c.w, y: c.y },
      { x: c.x + c.w, y: c.y + c.h },
      { x: c.x, y: c.y + c.h },
    ].map((p) => toScreen(cam, apply(m, p)))
    content = (
      <g>
        <path d={poly(cc)} fill="none" stroke="var(--guide-trim)" strokeWidth={1.5} strokeDasharray="6 4" />
        {cc.map((p, i) => (
          <rect key={i} x={p.x - HS / 2} y={p.y - HS / 2} width={HS} height={HS} fill="var(--guide-trim)" stroke="var(--ink)" strokeWidth={1.5} />
        ))}
      </g>
    )
  }

  // The resolution badge sits just inside the frame's top-left, clear of the legend.
  const badgeX = Math.max(Math.min(...corners.map((c) => c.x)) + 8, 30)
  const badgeY = Math.max(Math.min(...corners.map((c) => c.y)) + 8, 30)
  const ppi = layer.kind === 'image' && asset ? layerPpi(layer, asset) : null

  return (
    <g pointerEvents="none">
      {guideEls}
      <path
        d={isLine ? `M${corners[0].x} ${(corners[0].y + corners[3].y) / 2}L${corners[1].x} ${(corners[1].y + corners[2].y) / 2}` : poly(corners)}
        fill="none"
        stroke={layer.locked ? '#8f8a7f' : 'var(--signal)'}
        strokeWidth={1.5}
        strokeDasharray={layer.locked ? '4 3' : undefined}
      />
      {content}
      {!contentEdit && rot && (
        <g>
          <path d={`M${topMid.x} ${topMid.y}L${rot.s.x} ${rot.s.y}`} stroke="var(--signal)" strokeWidth={1.5} />
          <circle cx={rot.s.x} cy={rot.s.y} r={HS / 2 + 1} fill="var(--signal)" stroke="var(--ink)" strokeWidth={1.5} />
        </g>
      )}
      {!contentEdit &&
        handles
          .filter((h) => h.id !== 'rot')
          .map((h) => (
            <rect
              key={h.id}
              x={h.s.x - HS / 2}
              y={h.s.y - HS / 2}
              width={HS}
              height={HS}
              fill="#fff"
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
          ))}
      {ppi !== null && (
        <g transform={`translate(${Math.round(badgeX)} ${Math.round(badgeY)})`}>
          <rect width={68} height={18} fill="var(--lcd-bg)" stroke="var(--ink)" strokeWidth={1.5} />
          <text
            x={34}
            y={13}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={10.5}
            fill={ppiColor(ppi)}
          >
            {`${Math.round(ppi)} PPI`}
          </text>
        </g>
      )}
    </g>
  )
}
