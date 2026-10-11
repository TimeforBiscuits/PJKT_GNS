import { useRef } from 'react'
import { useSheetLayout } from '../editor/scenes'
import { BLEED_MM, FORMATS, SAFE_MM, bleedSize, panelSize } from '../model/formats'
import { PRINTERS } from '../model/imposition'
import { ptToMm } from '../model/units'
import { useEditor, type StrokeAlign } from '../store/editor'
import { Key, LcdField, Panel, Segmented, Toggle } from '../ui/controls'
import { IconPrint } from '../ui/icons'

const f1 = (v: number) => v.toFixed(1)

export function Inspector() {
  const view = useEditor((s) => s.view)
  const tool = useEditor((s) => s.tool)
  return (
    <aside className="inspector" aria-label="Inspector">
      {view === 'sheet' ? (
        <PrintPanel />
      ) : (
        <>
          <DocumentPanel />
          {tool === 'image' && <ImagePanel />}
          {(tool === 'rect' || tool === 'ellipse' || tool === 'polygon' || tool === 'line') && <ShapePanel />}
          {tool === 'text' && <TypePanel />}
          <LayersPanel />
        </>
      )}
    </aside>
  )
}

function DocumentPanel() {
  const format = FORMATS[useEditor((s) => s.formatId)]
  const guides = useEditor((s) => s.guides)
  const toggleGuide = useEditor((s) => s.toggleGuide)
  const trimPreview = useEditor((s) => s.trimPreview)
  const setTrimPreview = useEditor((s) => s.setTrimPreview)
  const demo = useEditor((s) => s.demoArt)
  const setDemo = useEditor((s) => s.setDemoArt)
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
        <Toggle on={demo} onChange={setDemo}>
          Demo art
        </Toggle>
      </div>
      <Toggle on={trimPreview} onChange={setTrimPreview} chip="var(--guide-trim)">
        Trim preview — as cut
      </Toggle>
    </Panel>
  )
}

function ImagePanel() {
  return (
    <Panel num="01" it="IMMAGINE" en="Image">
      <Key variant="ink" disabled>
        Import image…
      </Key>
      <div className="empty">
        <b>Next build</b>
        Full-bleed placement, drag to position inside the frame, crop handles, rotate &amp; flip, and a live
        effective-PPI meter.
      </div>
    </Panel>
  )
}

const SWATCHES = ['#111111', '#ffffff', '#ff4f00', '#e8e4da', '#8f8a7f', '#0038ff', '#00b39f', '#ffd400']

function ColorRow({ label, value, onChange }: { label: string; value: string | null; onChange: (c: string | null) => void }) {
  const picker = useRef<HTMLInputElement>(null)
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="swatches">
        <button
          type="button"
          className="swatch-key swatch-none"
          aria-label={`No ${label.toLowerCase()}`}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        />
        {SWATCHES.slice(0, 6).map((c) => (
          <button
            key={c}
            type="button"
            className="swatch-key"
            style={{ background: c }}
            aria-label={c}
            aria-pressed={value?.toLowerCase() === c}
            onClick={() => onChange(c)}
          />
        ))}
        <button
          type="button"
          className="swatch-key"
          style={{ background: 'conic-gradient(#ff4f00, #ffd400, #00b39f, #0038ff, #ff2a8a, #ff4f00)' }}
          aria-label="Custom colour"
          onClick={() => picker.current?.click()}
        />
        <input
          ref={picker}
          type="color"
          hidden
          value={value ?? '#111111'}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <span className="lcd">
        <span className="unit">HEX</span>
        {value ? value.toUpperCase() : '— NONE —'}
      </span>
    </div>
  )
}

function ShapePanel() {
  const style = useEditor((s) => s.style)
  const setStyle = useEditor((s) => s.setStyle)
  return (
    <Panel num="02" it="FORME" en="Shapes">
      <ColorRow label="Fill" value={style.fill} onChange={(fill) => setStyle({ fill })} />
      <ColorRow label="Stroke" value={style.stroke} onChange={(stroke) => setStyle({ stroke })} />
      <div className="grid-2">
        <LcdField
          label="Weight"
          unit="pt"
          value={style.strokeWidthPt}
          step={0.5}
          min={0}
          max={200}
          decimals={1}
          onChange={(strokeWidthPt) => setStyle({ strokeWidthPt })}
        />
        <div className="field">
          <span className="field-label">= mm</span>
          <span className="lcd">
            {ptToMm(style.strokeWidthPt).toFixed(2)}
            <span className="unit">mm</span>
          </span>
        </div>
      </div>
      <div className="field">
        <span className="field-label">Stroke sits</span>
        <Segmented<StrokeAlign>
          label="Stroke alignment"
          fill
          size="sm"
          value={style.strokeAlign}
          onChange={(strokeAlign) => setStyle({ strokeAlign })}
          options={[
            { value: 'inside', label: 'Inside' },
            { value: 'center', label: 'Centre' },
            { value: 'outside', label: 'Outside' },
          ]}
        />
      </div>
      <p className="note">
        <b>Inside</b> keeps a heavy frame exactly the size you draw it. Drawing arrives in the shapes build; these
        settings carry over.
      </p>
    </Panel>
  )
}

const WEIGHTS = ['500', '700', '800', '900'] as const

function TypePanel() {
  const style = useEditor((s) => s.style)
  const setStyle = useEditor((s) => s.setStyle)
  return (
    <Panel num="03" it="TESTO" en="Type">
      <div className="field">
        <span className="field-label">Typeface</span>
        <span className="lcd">
          {style.fontFamily.toUpperCase()}
          <span className="unit" style={{ marginLeft: 'auto' }}>
            sans
          </span>
        </span>
      </div>
      <div className="field">
        <span className="field-label">Weight</span>
        <Segmented<(typeof WEIGHTS)[number]>
          label="Weight"
          fill
          size="sm"
          value={String(style.fontWeight) as (typeof WEIGHTS)[number]}
          onChange={(w) => setStyle({ fontWeight: Number(w) })}
          options={WEIGHTS.map((w) => ({ value: w, label: w }))}
        />
      </div>
      <div className="grid-2">
        <LcdField label="Size" unit="pt" value={style.fontSizePt} step={1} min={1} max={999} decimals={1} onChange={(fontSizePt) => setStyle({ fontSizePt })} />
        <LcdField label="Leading" unit="pt" value={style.leadingPt} step={1} min={0} max={999} decimals={1} onChange={(leadingPt) => setStyle({ leadingPt })} />
        <LcdField label="Tracking" unit="/1000" value={style.tracking} step={5} min={-500} max={2000} onChange={(tracking) => setStyle({ tracking })} />
        <ColorChip />
      </div>
      <p className="note">The built-in library of bold sans faces and the text tool arrive in the type build.</p>
    </Panel>
  )
}

function ColorChip() {
  const fill = useEditor((s) => s.style.fill)
  return (
    <div className="field">
      <span className="field-label">Colour</span>
      <span className="lcd">
        <span style={{ width: 12, height: 12, background: fill ?? 'transparent', border: '1px solid #46f0dc', alignSelf: 'center' }} />
        {fill ? fill.toUpperCase() : 'NONE'}
      </span>
    </div>
  )
}

function LayersPanel() {
  return (
    <Panel num="05" it="LIVELLI" en="Layers">
      <div className="empty">
        <b>No layers yet</b>
        Images, shapes and text will stack here — reorder, lock and hide.
      </div>
    </Panel>
  )
}

function PrintPanel() {
  const format = FORMATS[useEditor((s) => s.formatId)]
  const printerId = useEditor((s) => s.printerId)
  const setPrinter = useEditor((s) => s.setPrinter)
  const dpi = useEditor((s) => s.dpi)
  const setDpi = useEditor((s) => s.setDpi)
  const marks = useEditor((s) => s.marks)
  const toggleMark = useEditor((s) => s.toggleMark)
  const layout = useSheetLayout()
  const rot = layout.placements[0]?.rotation ?? 0

  return (
    <Panel num="04" it="STAMPA" en="Print">
      <dl className="spec">
        <dt>Sheet</dt>
        <dd>A4 · 210.0 × 297.0</dd>
        <dt>Covers</dt>
        <dd>
          {layout.placements.length} × {format.name.toUpperCase()}
        </dd>
        <dt>Turned</dt>
        <dd>{rot}°</dd>
        <dt>Scale</dt>
        <dd>100 %</dd>
        <dt>Images at</dt>
        <dd>≤ {dpi} DPI</dd>
      </dl>

      <div className="field">
        <span className="field-label">Printer</span>
        <Segmented
          label="Printer"
          fill
          size="sm"
          value={printerId}
          onChange={setPrinter}
          options={Object.values(PRINTERS).map((p) => ({ value: p.id, label: p.id === 'pixma' ? 'Canon Pixma' : 'Generic 5 mm', title: p.name }))}
        />
      </div>
      <div className="field">
        <span className="field-label">Image resolution</span>
        <Segmented<'300' | '600'>
          label="Resolution"
          fill
          size="sm"
          value={String(dpi) as '300' | '600'}
          onChange={(v) => setDpi(Number(v) as 300 | 600)}
          options={[
            { value: '300', label: '300 dpi' },
            { value: '600', label: '600 dpi' },
          ]}
        />
      </div>
      <div className="grid-2">
        <Toggle on={marks.crop} onChange={() => toggleMark('crop')}>
          Crop marks
        </Toggle>
        <Toggle on={marks.fold} onChange={() => toggleMark('fold')}>
          Fold marks
        </Toggle>
      </div>

      {layout.bleedClipped && (
        <div className="warn">
          <b>!</b>
          <span>Part of the bleed lands in this printer’s no-print border and will come out white.</span>
        </div>
      )}
      <div className="warn">
        <b>!</b>
        <span>
          Print <b>with borders</b> at <b>100 % / Actual size</b>. The Pixma’s borderless mode enlarges the page and
          breaks the measurements.
        </span>
      </div>

      <Key variant="signal" disabled>
        <IconPrint />
        Export PDF
      </Key>
      <p className="note">
        PDF export and multi-cover sheets arrive in the print build. Cyan trim lines and the hatched no-print border
        are guides only — they never print.
      </p>
    </Panel>
  )
}
