import { SHEET_GAP, type Sheet } from '../model/compose'
import { CUT_DASH, CUT_GAP, placementTransform } from '../model/imposition'
import { A4, type Rect } from '../model/units'
import { useEditor } from '../store/editor'
import { Caption, DimH, DimV, Hatches } from './annotations'
import { CoverArt } from './CoverArt'
import { crisp, mm } from './draw'
import { useSheets } from './scenes'
import type { ViewInfo } from './Viewport'

/** Print preview: every A4 sheet in the queue, top to bottom, exactly as the PDF lays them out. */
export function SheetScene({ cam }: ViewInfo) {
  const sheets = useSheets()
  const guides = useEditor((s) => s.guides)
  const z = cam.zoom
  const S0: Rect = { x: cam.x, y: cam.y, w: A4.w * z, h: A4.h * z }

  return (
    <g pointerEvents="none">
      <Hatches />
      {sheets.length === 0 && (
        <g>
          <rect x={S0.x} y={S0.y} width={S0.w} height={S0.h} fill="none" stroke="#5c5850" strokeDasharray="6 5" strokeWidth={1.5} />
          <Caption x={S0.x + S0.w / 2} y={S0.y + S0.h / 2} color="#8f8a7f" size={11}>
            NO SHEETS — ADD ONE IN THE PANEL
          </Caption>
        </g>
      )}
      {sheets.map((sheet, i) => (
        <SheetView key={i} sheet={sheet} index={i} count={sheets.length} cam={cam} />
      ))}
      {guides.dims && sheets.length > 0 && (
        <g>
          <DimH x1={S0.x} x2={S0.x + S0.w} y={S0.y - 26} from={S0.y - 8} label={`A4 · ${mm(A4.w)} MM`} />
          <DimV y1={S0.y} y2={S0.y + S0.h} x={S0.x - 58} from={S0.x - 48} label={`${mm(A4.h)} MM`} />
        </g>
      )}
    </g>
  )
}

function SheetView({ sheet, index, count, cam }: { sheet: Sheet; index: number; count: number; cam: ViewInfo['cam'] }) {
  const showCuts = useEditor((s) => s.cutLines)
  const z = cam.zoom
  const oy = index * (A4.h + SHEET_GAP)
  const sx = (x: number) => cam.x + x * z
  const sy = (y: number) => cam.y + (oy + y) * z
  const S: Rect = { x: sx(0), y: sy(0), w: A4.w * z, h: A4.h * z }
  const { layout } = sheet
  const P = layout.printable
  const rectPath = (r: Rect) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`
  const period = CUT_DASH + CUT_GAP

  return (
    <g>
      <defs>
        {layout.placements.map((p, i) => (
          <clipPath key={i} id={`sheet-${index}-clip-${i}`} clipPathUnits="userSpaceOnUse">
            <rect x={p.bleed.x} y={p.bleed.y} width={p.bleed.w} height={p.bleed.h} />
          </clipPath>
        ))}
      </defs>
      <rect x={S.x + 6} y={S.y + 6} width={S.w} height={S.h} fill="rgba(0,0,0,0.55)" />
      <g transform={`translate(${cam.x} ${cam.y + oy * z}) scale(${z})`}>
        <rect x={0} y={0} width={A4.w} height={A4.h} fill="#fff" />
        {layout.placements.map((p, i) => {
          const cover = sheet.covers[i]
          return cover ? (
            <g key={i} clipPath={`url(#sheet-${index}-clip-${i})`}>
              <g transform={placementTransform(p)}>
                <CoverArt cover={cover} idp={`sh${index}-${i}`} />
              </g>
            </g>
          ) : null
        })}
      </g>

      <path d={rectPath(S) + rectPath({ x: sx(P.x), y: sy(P.y), w: P.w * z, h: P.h * z })} fillRule="evenodd" fill="url(#hatch-noprint)" />

      {layout.placements.map((p, i) => (
        <rect
          key={i}
          opacity={sheet.covers[i] ? 1 : 0.5}
          strokeDasharray={sheet.covers[i] ? undefined : '4 4'}
          x={crisp(sx(p.trim.x))}
          y={crisp(sy(p.trim.y))}
          width={Math.round(p.trim.w * z)}
          height={Math.round(p.trim.h * z)}
          fill="none"
          stroke="var(--guide-trim)"
        />
      ))}

      {/* the dashed cut lines, exactly as the PDF prints them (white paper only) */}
      {showCuts &&
        sheet.cuts.map((c, i) => (
          <path
            key={i}
            d={`M${sx(c.x1)} ${sy(c.y1)}L${sx(c.x2)} ${sy(c.y2)}`}
            stroke="#000"
            strokeWidth={1.2}
            strokeDasharray={`${CUT_DASH * z} ${CUT_GAP * z}`}
            strokeDashoffset={((c.x1 === c.x2 ? c.y1 : c.x1) % period) * z}
          />
        ))}

      {layout.placements.map((p, i) => {
        const cy = sy(p.trim.y + p.trim.h / 2)
        return (
          <g key={i}>
            <rect x={S.x - 42} y={cy - 11} width={28} height={22} fill="var(--signal)" stroke="var(--ink)" strokeWidth={2} />
            <text x={S.x - 28} y={cy + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight={600} fontSize={11} fill="var(--ink)">
              {String(i + 1).padStart(2, '0')}
            </text>
          </g>
        )
      })}

      <Caption x={S.x} y={S.y + S.h + 18} anchor="start" color="#d8d3c8" size={10}>
        {`SHEET ${index + 1} / ${count} · ${sheet.covers.filter(Boolean).length} × ${sheet.formatId.toUpperCase()}${sheet.spec.copies > 1 ? ` · PRINTS ×${sheet.spec.copies}` : ''}`}
      </Caption>
      {index === 0 && (
        <Caption x={S.x + S.w} y={S.y + S.h + 18} anchor="end" color="var(--signal)" size={10}>
          PRINT AT 100 % · WITH BORDERS
        </Caption>
      )}
    </g>
  )
}
