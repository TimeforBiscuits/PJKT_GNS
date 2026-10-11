import { FORMATS } from '../model/formats'
import { placementTransform } from '../model/imposition'
import { A4, type Rect } from '../model/units'
import { useEditor } from '../store/editor'
import { Caption, DimH, DimV, Hatches } from './annotations'
import { CoverArt } from './CoverArt'
import { crisp, mm } from './draw'
import { useSheetLayout } from './scenes'
import type { ViewInfo } from './Viewport'

/** Print preview: one portrait A4 sheet exactly as the PDF will lay it out. */
export function SheetScene({ cam }: ViewInfo) {
  const format = FORMATS[useEditor((s) => s.formatId)]
  const demo = useEditor((s) => s.demoArt)
  const marks = useEditor((s) => s.marks)
  const guides = useEditor((s) => s.guides)
  const layout = useSheetLayout()

  const z = cam.zoom
  const sx = (x: number) => cam.x + x * z
  const sy = (y: number) => cam.y + y * z
  const S: Rect = { x: sx(0), y: sy(0), w: A4.w * z, h: A4.h * z }
  const P = layout.printable
  const rectPath = (r: Rect) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`

  const visibleMarks = layout.marks.filter((m) => marks[m.kind])
  const markPath = (inBleed: boolean, kind: 'crop' | 'fold') =>
    visibleMarks
      .filter((m) => m.inBleed === inBleed && m.kind === kind)
      .map((m) => `M${sx(m.x1)} ${sy(m.y1)}L${sx(m.x2)} ${sy(m.y2)}`)
      .join('')

  return (
    <g pointerEvents="none">
      <Hatches />
      <defs>
        {layout.placements.map((p, i) => (
          <clipPath key={i} id={`sheet-clip-${i}`} clipPathUnits="userSpaceOnUse">
            <rect x={p.bleed.x} y={p.bleed.y} width={p.bleed.w} height={p.bleed.h} />
          </clipPath>
        ))}
      </defs>

      <rect x={S.x + 6} y={S.y + 6} width={S.w} height={S.h} fill="rgba(0,0,0,0.55)" />

      <g transform={`translate(${cam.x} ${cam.y}) scale(${z})`}>
        <rect x={0} y={0} width={A4.w} height={A4.h} fill="#fff" />
        {layout.placements.map((p, i) => (
          <g key={i} clipPath={`url(#sheet-clip-${i})`}>
            <g transform={placementTransform(p)}>
              <CoverArt format={format} demo={demo} />
            </g>
          </g>
        ))}
      </g>

      {/* the printer's no-print border */}
      <path
        d={rectPath(S) + rectPath({ x: sx(P.x), y: sy(P.y), w: P.w * z, h: P.h * z })}
        fillRule="evenodd"
        fill="url(#hatch-noprint)"
      />

      {layout.placements.map((p, i) => (
          <rect
            key={i}
            x={crisp(sx(p.trim.x))}
            y={crisp(sy(p.trim.y))}
            width={Math.round(p.trim.w * z)}
            height={Math.round(p.trim.h * z)}
            fill="none"
            stroke="var(--guide-trim)"
          />
      ))}

      {/* marks that land on discarded bleed get a white halo so they read on any image */}
      <path d={markPath(true, 'crop')} stroke="#fff" strokeWidth={3} />
      <path d={markPath(true, 'fold')} stroke="#fff" strokeWidth={3} />
      <path d={markPath(true, 'crop') + markPath(false, 'crop')} stroke="#000" strokeWidth={1.2} />
      <path d={markPath(true, 'fold') + markPath(false, 'fold')} stroke="#000" strokeWidth={1.2} strokeDasharray="3 2" />

      {layout.placements.map((p, i) => (
        <g key={i}>
          <rect x={S.x - 42} y={sy(p.trim.y + p.trim.h / 2) - 11} width={28} height={22} fill="var(--signal)" stroke="var(--ink)" strokeWidth={2} />
          <text
            x={S.x - 28}
            y={sy(p.trim.y + p.trim.h / 2) + 4}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontWeight={600}
            fontSize={11}
            fill="var(--ink)"
          >
            {String(i + 1).padStart(2, '0')}
          </text>
        </g>
      ))}

      {guides.dims && (
        <g>
          <DimH x1={S.x} x2={S.x + S.w} y={S.y - 26} from={S.y - 8} label={`A4 · ${mm(A4.w)} MM`} />
          <DimV y1={S.y} y2={S.y + S.h} x={S.x - 58} from={S.x - 48} label={`${mm(A4.h)} MM`} />
        </g>
      )}

      <Caption x={S.x + S.w / 2} y={S.y + S.h + 28} color="var(--signal)" size={10}>
        PRINT AT 100 % · ACTUAL SIZE · WITH BORDERS
      </Caption>
    </g>
  )
}
