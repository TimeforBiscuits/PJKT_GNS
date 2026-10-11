import { layerLabel, type Layer } from '../../model/doc'
import { useDoc } from '../../store/doc'
import { Key, LcdField, Panel, Toggle } from '../../ui/controls'

/** Position, size, rotation and opacity of the selected layer, in millimetres. */
export function TransformPanel({ layer }: { layer: Layer }) {
  const update = useDoc((s) => s.updateLayer)
  const remove = useDoc((s) => s.removeLayer)
  const duplicate = useDoc((s) => s.duplicateLayer)
  const restack = useDoc((s) => s.restack)
  const set = (patch: Partial<Layer>) => update(layer.id, patch)
  const isLine = layer.kind === 'shape' && layer.shape === 'line'
  const isText = layer.kind === 'text'

  // Resize about the centre so rotated frames don't drift.
  const resize = (w: number, h: number) => set({ x: layer.x + (layer.w - w) / 2, y: layer.y + (layer.h - h) / 2, w, h })

  return (
    <Panel num="XY" it="POSIZIONE" en={layerLabel[layer.kind]}>
      <div className="layer-name">
        <span className="field-label">Name</span>
        <span className="lcd">
          <input value={layer.name} onChange={(e) => set({ name: e.target.value })} spellCheck={false} />
        </span>
      </div>
      <div className="grid-2">
        <LcdField label="X" unit="mm" value={layer.x} step={0.5} decimals={1} onChange={(x) => set({ x })} />
        <LcdField label="Y" unit="mm" value={layer.y} step={0.5} decimals={1} onChange={(y) => set({ y })} />
        <LcdField
          label={isLine ? 'Length' : 'W'}
          unit="mm"
          value={layer.w}
          step={0.5}
          min={0.5}
          decimals={1}
          onChange={(w) => resize(w, layer.h)}
        />
        {isLine ? (
          <LcdField label="Angle" unit="°" value={layer.rotation} step={1} min={-180} max={180} decimals={1} onChange={(rotation) => set({ rotation })} />
        ) : isText ? (
          <div className="field">
            <span className="field-label">H · auto</span>
            <span className="lcd">
              {layer.h.toFixed(1)}
              <span className="unit">mm</span>
            </span>
          </div>
        ) : (
          <LcdField label="H" unit="mm" value={layer.h} step={0.5} min={0.5} decimals={1} onChange={(h) => resize(layer.w, h)} />
        )}
        {!isLine && (
          <LcdField label="Rotate" unit="°" value={layer.rotation} step={1} min={-180} max={180} decimals={1} onChange={(rotation) => set({ rotation })} />
        )}
        <LcdField
          label="Opacity"
          unit="%"
          value={Math.round(layer.opacity * 100)}
          step={5}
          min={0}
          max={100}
          onChange={(o) => set({ opacity: o / 100 })}
        />
      </div>
      <div className="grid-2">
        <Toggle on={layer.locked} onChange={(locked) => set({ locked })}>
          Lock
        </Toggle>
        <Toggle on={layer.hidden} onChange={(hidden) => set({ hidden })}>
          Hide
        </Toggle>
      </div>
      <div className="grid-4">
        <Key size="sm" onClick={() => restack(layer.id, 'up')} title="Bring forward (⌘])">
          ▲ Fwd
        </Key>
        <Key size="sm" onClick={() => restack(layer.id, 'down')} title="Send backward (⌘[)">
          ▼ Back
        </Key>
        <Key size="sm" onClick={() => duplicate(layer.id)} title="Duplicate (⌘D)">
          Dup
        </Key>
        <Key size="sm" onClick={() => remove(layer.id)} title="Delete (⌫)">
          Del
        </Key>
      </div>
    </Panel>
  )
}
