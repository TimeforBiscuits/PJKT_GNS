import { useEditor, type Camera } from '../store/editor'

export const RULER = 22

const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

/** Pick tick spacings that stay legible at the current zoom. */
const ticksFor = (zoom: number) => {
  const minor = STEPS.find((s) => s * zoom >= 5) ?? 1000
  const label = STEPS.find((s) => s * zoom >= 46 && s % minor === 0) ?? 1000
  return { minor, label }
}

function ticks(origin: number, zoom: number, length: number) {
  const { minor, label } = ticksFor(zoom)
  const from = Math.floor((RULER - origin) / zoom / minor) * minor
  const to = (length - origin) / zoom
  const out: { pos: number; mm: number; kind: 'label' | 'mid' | 'minor' }[] = []
  for (let mm = from; mm <= to; mm += minor) {
    const m = Math.round(mm * 1000) / 1000
    const pos = Math.round(origin + m * zoom) + 0.5
    if (pos < RULER) continue
    const kind = m % label === 0 ? 'label' : m % (label / 2) === 0 ? 'mid' : 'minor'
    out.push({ pos, mm: m, kind })
  }
  return out
}

const tickLen = { label: 12, mid: 7, minor: 4 }

/** Millimetre rulers along the top and left edges, zeroed on the trim corner. */
export function Rulers({ cam, size }: { cam: Camera; size: { w: number; h: number } }) {
  const cursor = useEditor((s) => s.cursor)
  const top = ticks(cam.x, cam.zoom, size.w)
  const left = ticks(cam.y, cam.zoom, size.h)

  let topPath = ''
  for (const t of top) topPath += `M${t.pos} ${RULER}v${-tickLen[t.kind]}`
  let leftPath = ''
  for (const t of left) leftPath += `M${RULER} ${t.pos}h${-tickLen[t.kind]}`

  const cx = cursor ? cam.x + cursor.x * cam.zoom : null
  const cy = cursor ? cam.y + cursor.y * cam.zoom : null

  return (
    <g pointerEvents="none" fontFamily="var(--font-mono)" fontSize={9} fill="var(--ink-2)">
      <rect x={0} y={0} width={size.w} height={RULER} fill="var(--chassis)" />
      <rect x={0} y={0} width={RULER} height={size.h} fill="var(--chassis)" />
      <path d={`M0 ${RULER - 0.5}H${size.w}M${RULER - 0.5} 0V${size.h}`} stroke="var(--ink)" />
      <path d={topPath} stroke="var(--ink)" />
      <path d={leftPath} stroke="var(--ink)" />
      {top
        .filter((t) => t.kind === 'label')
        .map((t) => (
          <text key={t.mm} x={t.pos + 3} y={9}>
            {t.mm}
          </text>
        ))}
      {left
        .filter((t) => t.kind === 'label')
        .map((t) => (
          <text key={t.mm} x={9} y={t.pos + 3} textAnchor="end" transform={`rotate(-90 9 ${t.pos + 3})`}>
            {t.mm}
          </text>
        ))}
      {cx !== null && cx > RULER && (
        <path d={`M${Math.round(cx) + 0.5} 0v${RULER}`} stroke="var(--signal)" strokeWidth={1.5} />
      )}
      {cy !== null && cy > RULER && (
        <path d={`M0 ${Math.round(cy) + 0.5}h${RULER}`} stroke="var(--signal)" strokeWidth={1.5} />
      )}
      <rect x={0} y={0} width={RULER} height={RULER} fill="var(--ink)" />
      <text x={RULER / 2} y={RULER / 2 + 3} textAnchor="middle" fill="var(--signal)" fontSize={8}>
        MM
      </text>
    </g>
  )
}
