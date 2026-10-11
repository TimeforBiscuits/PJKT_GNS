import { BLEED_MM, FORMATS, bleedRect, foldX, panelSize, safeRects } from '../model/formats'
import type { Rect } from '../model/units'
import { useActiveCover } from '../store/doc'
import { useEditor } from '../store/editor'
import { Caption, DimH, DimV, Hatches } from './annotations'
import { CoverArt } from './CoverArt'
import { crisp, mm } from './draw'
import { ContentGhost, SelectionOverlay } from './Selection'
import type { ViewInfo } from './Viewport'

/** The cover template: artwork plus non-printing trim, bleed, safe-zone and fold guides. */
export function CoverScene({ cam, size }: ViewInfo) {
  const cover = useActiveCover()
  const format = FORMATS[cover.formatId]
  const guides = useEditor((s) => s.guides)
  const trimPreview = useEditor((s) => s.trimPreview)

  const z = cam.zoom
  const sx = (x: number) => cam.x + x * z
  const sy = (y: number) => cam.y + y * z
  const toScreen = (r: Rect): Rect => ({ x: sx(r.x), y: sy(r.y), w: r.w * z, h: r.h * z })

  const trim: Rect = { x: 0, y: 0, w: format.trim.w, h: format.trim.h }
  const bleed = bleedRect(format)
  const T = toScreen(trim)
  const B = toScreen(bleed)
  const paper = trimPreview ? T : B
  const fx = sx(foldX(format))
  const panel = panelSize(format)
  const safe = safeRects(format)
  const showBleed = guides.bleed && !trimPreview
  const showGuides = !trimPreview

  const rectPath = (r: Rect) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`

  return (
    <g pointerEvents="none">
      <Hatches />
      <defs>
        <clipPath id="cover-clip" clipPathUnits="userSpaceOnUse">
          <rect x={(trimPreview ? trim : bleed).x} y={(trimPreview ? trim : bleed).y} width={(trimPreview ? trim : bleed).w} height={(trimPreview ? trim : bleed).h} />
        </clipPath>
      </defs>

      {/* hard 90s drop shadow */}
      <rect x={paper.x + 6} y={paper.y + 6} width={paper.w} height={paper.h} fill="rgba(0,0,0,0.55)" />

      <g transform={`translate(${cam.x} ${cam.y}) scale(${z})`}>
        <g clipPath="url(#cover-clip)">
          <CoverArt cover={cover} idp="ed" />
        </g>
        <ContentGhost />
      </g>

      {showBleed && (
        <>
          <path d={rectPath(B) + rectPath(T)} fillRule="evenodd" fill="url(#hatch-bleed)" />
          <rect
            x={crisp(B.x)}
            y={crisp(B.y)}
            width={Math.round(B.w)}
            height={Math.round(B.h)}
            fill="none"
            stroke="var(--guide-bleed)"
            strokeDasharray="6 4"
          />
        </>
      )}

      {showGuides && (
        <>
          <rect x={crisp(T.x)} y={crisp(T.y)} width={Math.round(T.w)} height={Math.round(T.h)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={3.5} />
          <rect x={crisp(T.x)} y={crisp(T.y)} width={Math.round(T.w)} height={Math.round(T.h)} fill="none" stroke="var(--guide-trim)" strokeWidth={1.5} />
        </>
      )}

      {showGuides &&
        guides.safe &&
        (['back', 'front'] as const).map((id) => {
          const r = toScreen(safe[id])
          return (
            <rect
              key={id}
              x={crisp(r.x)}
              y={crisp(r.y)}
              width={Math.round(r.w)}
              height={Math.round(r.h)}
              fill="none"
              stroke="var(--guide-safe)"
              strokeDasharray="3 3"
            />
          )
        })}

      {guides.fold && (
        <g>
          <path d={`M${crisp(fx)} ${paper.y - 14}V${paper.y + paper.h + 14}`} stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeDasharray="0 6" />
          <path d={`M${crisp(fx)} ${paper.y - 14}V${paper.y + paper.h + 14}`} stroke="var(--guide-fold)" strokeWidth={1.8} strokeLinecap="round" strokeDasharray="0 6" />
        </g>
      )}

      {/* panel names sit on the pasteboard, never on the artwork */}
      <Caption x={sx(panel.w / 2)} y={paper.y - 12} color="#e9e4d8">
        RETRO · BACK
      </Caption>
      <Caption x={sx(panel.w * 1.5)} y={paper.y - 12} color="#e9e4d8">
        FRONTE · FRONT
      </Caption>
      {guides.fold && (
        <Caption x={fx} y={paper.y + paper.h + 30} color="var(--paste-ink)" size={9}>
          PIEGA · FOLD
        </Caption>
      )}

      {guides.dims && (
        <g>
          <DimH x1={T.x} x2={fx} y={paper.y - 40} from={paper.y - 26} label={mm(panel.w)} />
          <DimH x1={fx} x2={T.x + T.w} y={paper.y - 40} from={paper.y - 26} label={mm(panel.w)} />
          <DimH x1={T.x} x2={T.x + T.w} y={paper.y - 66} from={paper.y - 46} label={`${mm(format.trim.w)} MM`} />
          <DimV y1={T.y} y2={T.y + T.h} x={paper.x - 30} from={paper.x - 8} label={`${mm(format.trim.h)} MM`} />
          {showBleed && (
            <Caption x={B.x} y={B.y + B.h + 22} anchor="start" color="var(--guide-bleed)" size={9}>
              {`BLEED ${mm(BLEED_MM)} MM · STICKER CUT ON THE OUTER EDGE · FINAL TRIM ON CYAN`}
            </Caption>
          )}
        </g>
      )}
      <SelectionOverlay cam={cam} size={size} />
    </g>
  )
}
