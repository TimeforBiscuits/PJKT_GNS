import { useSheetLayout } from '../../editor/scenes'
import { BLEED_MM, FORMATS, SAFE_MM, bleedSize, panelSize } from '../../model/formats'
import { useActiveCover, useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { ColorRow } from '../../ui/ColorRow'
import { Panel, Toggle } from '../../ui/controls'

const f1 = (v: number) => v.toFixed(1)

export function DocumentPanel() {
  const cover = useActiveCover()
  const format = FORMATS[cover.formatId]
  const edit = useDoc((s) => s.edit)
  const guides = useEditor((s) => s.guides)
  const toggleGuide = useEditor((s) => s.toggleGuide)
  const trimPreview = useEditor((s) => s.trimPreview)
  const setTrimPreview = useEditor((s) => s.setTrimPreview)
  const layout = useSheetLayout()
  const panel = panelSize(format)
  const bleed = bleedSize(format)

  return (
    <Panel num="00" it="DOCUMENTO" en="Document">
      <dl className="spec">
        <dt>Format</dt>
        <dd>{format.name.toUpperCase()}</dd>
        <dt>Flat · trim</dt>
        <dd>
          {f1(format.trim.w)} × {f1(format.trim.h)}
        </dd>
        <dt>Panel ×2</dt>
        <dd>
          {f1(panel.w)} × {f1(panel.h)}
        </dd>
        <dt>Fold at</dt>
        <dd>X {f1(panel.w)}</dd>
        <dt>Bleed</dt>
        <dd>
          {f1(BLEED_MM)} → {f1(bleed.w)} × {f1(bleed.h)}
        </dd>
        <dt>Safe zone</dt>
        <dd>{f1(SAFE_MM)}</dd>
        <dt>Per A4</dt>
        <dd>{layout.placements.length}</dd>
      </dl>
      <ColorRow
        label="Paper"
        allowNone={false}
        value={cover.background}
        onChange={(c) =>
          edit((_, cv) => {
            cv.background = c ?? '#ffffff'
          })
        }
      />
      <div className="grid-2">
        <Toggle on={guides.bleed} onChange={() => toggleGuide('bleed')} chip="var(--guide-bleed)">
          Bleed
        </Toggle>
        <Toggle on={guides.safe} onChange={() => toggleGuide('safe')} chip="var(--guide-safe)">
          Safe
        </Toggle>
        <Toggle on={guides.fold} onChange={() => toggleGuide('fold')} chip="var(--ink)">
          Fold
        </Toggle>
        <Toggle on={guides.dims} onChange={() => toggleGuide('dims')}>
          Dims
        </Toggle>
        <Toggle on={guides.rulers} onChange={() => toggleGuide('rulers')}>
          Rulers
        </Toggle>
        <Toggle on={trimPreview} onChange={setTrimPreview} chip="var(--guide-trim)">
          As cut
        </Toggle>
      </div>
    </Panel>
  )
}
