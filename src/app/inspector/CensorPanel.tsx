import { useState } from 'react'
import { useCensorFace } from '../../fonts/registry'
import { fitWidth, layoutCensor } from '../../model/censor'
import type { CensorLayer, CensorWeight, TextAlign } from '../../model/doc'
import { reframe } from '../../model/geometry'
import { mmToPt } from '../../model/units'
import { useDoc } from '../../store/doc'
import { ColorRow } from '../../ui/ColorRow'
import { Key, LcdField, Panel, Segmented, Toggle } from '../../ui/controls'
import { KnockoutNote } from './TextPanel'

/** The TOP SECRET stripe: its words, weight and colours. Its thickness sets the type size. */
export function CensorPanel({ layer }: { layer: CensorLayer }) {
  const update = useDoc((s) => s.updateLayer)
  const set = (patch: Partial<CensorLayer>) => update<CensorLayer>(layer.id, patch)
  const face = useCensorFace(layer.weight)
  const layout = face ? layoutCensor(face, layer) : null
  // The words are typed into a draft and land as one undo step.
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null)
  const text = draft && draft.base === layer.text ? draft.text : layer.text
  const commit = () => {
    if (draft && draft.text !== layer.text) set({ text: draft.text })
    setDraft(null)
  }

  /** Stretch or shrink the stripe to its words, keeping the aligned end (or the middle) in place. */
  const fit = () => {
    if (!layout) return
    const w = Math.max(5, fitWidth(layout))
    const l = layer.align === 'left' ? 0 : layer.align === 'right' ? layer.w - w : (layer.w - w) / 2
    set(reframe(layer, l, 0, l + w, layer.h))
  }

  const overflow = layout ? fitWidth(layout) > layer.w + 0.05 : false

  return (
    <Panel num="TS" it="TOP SECRET" en="Censor stripe">
      <label className="field">
        <span className="field-label">Words</span>
        <span className="lcd censor-words">
          <input
            value={text}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="done"
            aria-label="Stripe words"
            onChange={(e) => setDraft({ text: e.target.value, base: layer.text })}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setDraft(null)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
          />
        </span>
      </label>

      <div className="field">
        <span className="field-label">Weight · Courier Prime</span>
        <Segmented<CensorWeight>
          label="Weight"
          fill
          size="sm"
          value={layer.weight}
          onChange={(weight) => set({ weight })}
          options={[
            { value: 'regular', label: 'Regular' },
            { value: 'medium', label: 'Medium' },
            { value: 'bold', label: 'Bold' },
          ]}
        />
      </div>

      <div className="grid-2">
        <LcdField
          label="Gap"
          unit="pt"
          value={layer.insetPt}
          step={0.5}
          min={0}
          max={Math.max(0, mmToPt(layer.h) / 2 - 1)}
          decimals={1}
          onChange={(insetPt) => set({ insetPt })}
        />
        <div className="field">
          <span className="field-label">Type size</span>
          <span className="lcd" aria-label="Type size">
            {layout ? layout.sizePt.toFixed(1) : '—'}
            <span className="unit">pt</span>
          </span>
        </div>
        <LcdField label="Tracking" unit="/1000" value={layer.tracking} step={10} min={-200} max={1000} onChange={(tracking) => set({ tracking })} />
        <div className="field">
          <span className="field-label">Align</span>
          <Segmented<TextAlign>
            label="Alignment"
            fill
            size="sm"
            value={layer.align}
            onChange={(align) => set({ align })}
            options={[
              { value: 'left', label: 'L', title: 'Left' },
              { value: 'center', label: 'C', title: 'Centre' },
              { value: 'right', label: 'R', title: 'Right' },
            ]}
          />
        </div>
      </div>

      <div className="grid-2">
        <Toggle on={layer.uppercase} onChange={(uppercase) => set({ uppercase })}>
          All caps
        </Toggle>
        <Key onClick={fit} disabled={!layout} title="Make the stripe just long enough for its words">
          Fit length
        </Key>
      </div>
      <p className="note">
        Draw it thicker and the type grows with it. {overflow ? <b>The words run past the ends and are cut off — Fit length shows them all.</b> : 'Words that run past the ends are cut off.'}
      </p>

      <ColorRow label="Stripe" allowNone={false} value={layer.fill} onChange={(c) => set({ fill: c ?? '#0d0d0c' })} />
      <Toggle on={!!layer.knockout} onChange={(knockout) => set({ knockout })}>
        Knockout letters
      </Toggle>
      {layer.knockout ? (
        <KnockoutNote />
      ) : (
        <ColorRow label="Letters" allowNone={false} value={layer.color} onChange={(c) => set({ color: c ?? '#edeef0' })} />
      )}
    </Panel>
  )
}
