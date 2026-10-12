import type { BenDay, Distress, Effects, Layer } from '../../model/doc'
import { useDoc } from '../../store/doc'
import { Key, Panel, Toggle } from '../../ui/controls'
import { GestureSlider } from './GestureSlider'

const NONE: Effects = { benday: null, distress: null }
const BENDAY: BenDay = { strength: 60, dotMm: 1.8 }
const newSeed = () => Math.floor(Math.random() * 1e9)

/** A slider with its reading in an LCD beside it. */
function Reading({ label, value, min, max, step, unit, decimals = 0, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; decimals?: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="slider-row">
        <GestureSlider label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
        <span className="lcd slider-lcd">
          {value.toFixed(decimals)}
          <span className="unit">{unit}</span>
        </span>
      </div>
    </div>
  )
}

/** How the selected layer is finished: its opacity and its print effects. */
export function EffectsPanel({ layer }: { layer: Layer }) {
  const update = useDoc((s) => s.updateLayer)
  const fx = layer.effects ?? NONE
  const setFx = (patch: Partial<Effects>) => update(layer.id, { effects: { ...fx, ...patch } })
  const setBenday = (p: Partial<BenDay>) => fx.benday && setFx({ benday: { ...fx.benday, ...p } })
  const setDistress = (p: Partial<Distress>) => fx.distress && setFx({ distress: { ...fx.distress, ...p } })
  const picture = layer.kind === 'image'

  return (
    <Panel num="FX" it="EFFETTI" en="Effects">
      <Reading label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} step={1} unit="%" onChange={(v) => update(layer.id, { opacity: v / 100 })} />

      <div className="fx-block">
        <Toggle on={!!fx.benday} onChange={(on) => setFx({ benday: on ? { ...BENDAY } : null })}>
          Ben-Day dots
        </Toggle>
        {fx.benday && (
          <>
            <Reading label="Strength" value={fx.benday.strength} min={0} max={100} step={1} unit="%" onChange={(strength) => setBenday({ strength })} />
            <Reading label="Dot size" value={fx.benday.dotMm} min={0.6} max={5} step={0.1} unit="mm" decimals={1} onChange={(dotMm) => setBenday({ dotMm })} />
            <p className="note">{picture ? 'The picture as a comic print: dots of process colour, sized by tone.' : 'Flat colour becomes dots of that colour; outlines stay solid.'}</p>
          </>
        )}
      </div>

      <div className="fx-block">
        <Toggle on={!!fx.distress} onChange={(on) => setFx({ distress: on ? { strength: 30, seed: newSeed() } : null })}>
          Distressed
        </Toggle>
        {fx.distress && (
          <>
            <Reading label="Wear" value={fx.distress.strength} min={0} max={100} step={1} unit="%" onChange={(strength) => setDistress({ strength })} />
            <Key size="sm" onClick={() => setDistress({ seed: newSeed() })} title="Another pattern of wear">
              Shuffle
            </Key>
          </>
        )}
      </div>
      {(fx.benday || fx.distress) && <p className="note">Effects print as pictures at the PDF’s resolution.</p>}
    </Panel>
  )
}
