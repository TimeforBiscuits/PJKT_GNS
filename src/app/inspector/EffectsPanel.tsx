import type { Layer } from '../../model/doc'
import { useDoc } from '../../store/doc'
import { Panel } from '../../ui/controls'
import { GestureSlider } from './GestureSlider'

/** How the selected layer is finished: its opacity, and later its print effects. */
export function EffectsPanel({ layer }: { layer: Layer }) {
  const update = useDoc((s) => s.updateLayer)
  const pct = Math.round(layer.opacity * 100)
  return (
    <Panel num="FX" it="EFFETTI" en="Effects">
      <div className="field">
        <span className="field-label">Opacity</span>
        <div className="slider-row">
          <GestureSlider label="Opacity" value={pct} min={0} max={100} step={1} onChange={(v) => update(layer.id, { opacity: v / 100 })} />
          <span className="lcd slider-lcd">
            {String(pct).padStart(3, ' ')}
            <span className="unit">%</span>
          </span>
        </div>
      </div>
    </Panel>
  )
}
