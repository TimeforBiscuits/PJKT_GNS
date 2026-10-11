import type { LineCap, ShapeKind, ShapeLayer, StrokeAlign } from '../../model/doc'
import { ptToMm } from '../../model/units'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { ColorRow } from '../../ui/ColorRow'
import { LcdField, Panel, Segmented } from '../../ui/controls'

interface ShapeStyle {
  fill: string | null
  stroke: string | null
  strokeWidthPt: number
  strokeAlign: StrokeAlign
  cap?: LineCap
  sides: number
  radius: number
}

function ShapeControls({
  shape,
  value,
  onChange,
}: {
  /** null when editing tool defaults that apply to every shape. */
  shape: ShapeKind | null
  value: ShapeStyle
  onChange: (patch: Partial<ShapeStyle>) => void
}) {
  const line = shape === 'line'
  return (
    <>
      {!line && <ColorRow label="Fill" value={value.fill} onChange={(fill) => onChange({ fill })} />}
      <ColorRow label={line ? 'Colour' : 'Stroke'} value={value.stroke} allowNone={!line} onChange={(stroke) => onChange({ stroke })} />
      <div className="grid-2">
        <LcdField
          label="Weight"
          unit="pt"
          value={value.strokeWidthPt}
          step={0.5}
          min={0}
          max={500}
          decimals={1}
          onChange={(strokeWidthPt) => onChange({ strokeWidthPt })}
        />
        <div className="field">
          <span className="field-label">= mm</span>
          <span className="lcd">
            {ptToMm(value.strokeWidthPt).toFixed(2)}
            <span className="unit">mm</span>
          </span>
        </div>
        {shape === 'rect' && (
          <LcdField label="Corners" unit="mm" value={value.radius} step={0.5} min={0} max={200} decimals={1} onChange={(radius) => onChange({ radius })} />
        )}
        {(shape === 'polygon' || shape === null) && (
          <LcdField label="Sides" value={value.sides} step={1} min={3} max={24} onChange={(sides) => onChange({ sides })} />
        )}
      </div>
      {line ? (
        <div className="field">
          <span className="field-label">Ends</span>
          <Segmented<LineCap>
            label="Line ends"
            fill
            size="sm"
            value={value.cap ?? 'butt'}
            onChange={(cap) => onChange({ cap })}
            options={[
              { value: 'butt', label: 'Flat' },
              { value: 'square', label: 'Square' },
              { value: 'round', label: 'Round' },
            ]}
          />
        </div>
      ) : (
        <div className="field">
          <span className="field-label">Stroke sits</span>
          <Segmented<StrokeAlign>
            label="Stroke alignment"
            fill
            size="sm"
            value={value.strokeAlign}
            onChange={(strokeAlign) => onChange({ strokeAlign })}
            options={[
              { value: 'inside', label: 'Inside' },
              { value: 'center', label: 'Centre' },
              { value: 'outside', label: 'Outside' },
            ]}
          />
        </div>
      )}
    </>
  )
}

export function ShapePanel({ layer }: { layer: ShapeLayer }) {
  const update = useDoc((s) => s.updateLayer)
  return (
    <Panel num="02" it="FORME" en={layer.shape}>
      <ShapeControls shape={layer.shape} value={layer} onChange={(p) => update<ShapeLayer>(layer.id, p)} />
    </Panel>
  )
}

/** Defaults for the next shape you draw. */
export function ShapeToolPanel() {
  const style = useEditor((s) => s.style)
  const setStyle = useEditor((s) => s.setStyle)
  const tool = useEditor((s) => s.tool) as ShapeKind
  return (
    <Panel num="02" it="FORME" en="New shapes">
      <ShapeControls shape={tool} value={style} onChange={setStyle} />
      <p className="note">
        <b>Drag</b> on the cover to draw, <b>tap</b> for a 30 mm shape. Shift keeps it square; Alt/⌥ turns snapping
        off. <b>Inside</b> keeps a heavy frame exactly the size you draw.
      </p>
    </Panel>
  )
}
