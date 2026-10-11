import { CoverThumb } from '../../editor/CoverThumb'
import { useSheets } from '../../editor/scenes'
import { FORMATS } from '../../model/formats'
import { PRINTERS } from '../../model/imposition'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { Key, Panel, Segmented, Toggle } from '../../ui/controls'
import { ExportControls } from './ExportControls'

export function PrintPanel() {
  const printerId = useEditor((s) => s.printerId)
  const setPrinter = useEditor((s) => s.setPrinter)
  const dpi = useEditor((s) => s.dpi)
  const setDpi = useEditor((s) => s.setDpi)
  const marks = useEditor((s) => s.marks)
  const toggleMark = useEditor((s) => s.toggleMark)
  const sheets = useSheets()
  const covers = sheets.reduce((n, s) => n + s.covers.length, 0)
  const clipped = sheets.some((s) => s.layout.bleedClipped)

  return (
    <Panel num="04" it="STAMPA" en="Print">
      <dl className="spec">
        <dt>Paper</dt>
        <dd>A4 · 210.0 × 297.0</dd>
        <dt>Sheets</dt>
        <dd>{sheets.length}</dd>
        <dt>Covers</dt>
        <dd>{covers}</dd>
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

      {clipped && (
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

      <ExportControls />
    </Panel>
  )
}

/** How many of each cover to print. */
export function QueuePanel() {
  const covers = useDoc((s) => s.project.covers)
  const queue = useDoc((s) => s.project.queue)
  const edit = useDoc((s) => s.edit)
  const setCopies = (id: string, n: number) =>
    edit((p) => {
      p.queue[id] = Math.max(0, Math.min(99, n))
    })

  return (
    <Panel num="07" it="CODA" en="Print queue">
      <ul className="queue">
        {covers.map((c, i) => {
          const n = queue[c.id] ?? 0
          return (
            <li key={c.id} className="queue-row" style={{ opacity: n ? 1 : 0.55 }}>
              <CoverThumb cover={c} height={40} />
              <span className="queue-name">
                <b>{String(i + 1).padStart(2, '0')}</b> {c.name}
                <small>{FORMATS[c.formatId].name}</small>
              </span>
              <span className="queue-count">
                <Key size="sm" square onClick={() => setCopies(c.id, n - 1)} aria-label="Fewer copies">
                  −
                </Key>
                <span className="lcd">{n}</span>
                <Key size="sm" square onClick={() => setCopies(c.id, n + 1)} aria-label="More copies">
                  +
                </Key>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="note">Notebooks share sheets two to a page; Squares print one per page.</p>
    </Panel>
  )
}
