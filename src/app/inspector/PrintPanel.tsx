import { useState } from 'react'
import { CoverThumb } from '../../editor/CoverThumb'
import { useSheets } from '../../editor/scenes'
import { FORMATS, FORMAT_IDS, type FormatId } from '../../model/formats'
import { DEFAULT_PRINTER, PRINTERS, layoutSheet } from '../../model/imposition'
import { newSheet, pageCount } from '../../model/sheets'
import type { Cover, SheetSpec } from '../../model/doc'
import { A4 } from '../../model/units'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { Key, Panel, Segmented, Toggle } from '../../ui/controls'
import { ExportControls } from './ExportControls'

export function PrintPanel() {
  const printerId = useEditor((s) => s.printerId)
  const setPrinter = useEditor((s) => s.setPrinter)
  const dpi = useEditor((s) => s.dpi)
  const setDpi = useEditor((s) => s.setDpi)
  const cutLines = useEditor((s) => s.cutLines)
  const setCutLines = useEditor((s) => s.setCutLines)
  const project = useDoc((s) => s.project)
  const sheets = useSheets()
  const covers = sheets.reduce((n, s) => n + s.covers.filter(Boolean).length * s.spec.copies, 0)
  const clipped = sheets.some((s) => s.layout.bleedClipped)

  return (
    <Panel num="04" it="STAMPA" en="Print">
      <dl className="spec">
        <dt>Paper</dt>
        <dd>A4 · 210.0 × 297.0</dd>
        <dt>Pages</dt>
        <dd>{pageCount(project)}</dd>
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
      <Toggle on={cutLines} onChange={setCutLines} chip="repeating-linear-gradient(90deg,#000 0 4px,transparent 4px 7px)">
        Dashed cut lines
      </Toggle>
      <p className="note">
        The only marks printed: dashes on the white paper along each picture’s outer edge. Cut there and the sticker
        keeps its <b>2 mm bleed</b> — trim that off after mounting.
      </p>

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

/** Mini A4 with its slots; tap a slot to choose its cover. */
function SheetCard({ spec, index }: { spec: SheetSpec; index: number }) {
  const covers = useDoc((s) => s.project.covers)
  const edit = useDoc((s) => s.edit)
  const [picking, setPicking] = useState<number | null>(null)
  const layout = layoutSheet(FORMATS[spec.formatId], { printer: DEFAULT_PRINTER })
  const W = 96
  const k = W / A4.w
  const byId = new Map(covers.map((c) => [c.id, c]))
  const choices = covers.filter((c) => c.formatId === spec.formatId)

  const update = (fn: (s: SheetSpec) => void) =>
    edit((p) => {
      const s = p.sheets.find((x) => x.id === spec.id)
      if (s) fn(s)
    })

  return (
    <li className="sheet-card">
      <div className="sheet-mini" style={{ width: W, height: A4.h * k }}>
        {layout.placements.map((pl, i) => {
          const cover = byId.get(spec.slots[i] ?? '') as Cover | undefined
          const bw = pl.trim.w * k
          const bh = pl.trim.h * k
          return (
            <button
              key={i}
              type="button"
              className={picking === i ? 'slot is-picking' : 'slot'}
              style={{ left: pl.trim.x * k, top: pl.trim.y * k, width: bw, height: bh }}
              onClick={() => setPicking(picking === i ? null : i)}
              aria-label={`Slot ${i + 1}: ${cover?.name ?? 'empty'}`}
            >
              {cover ? (
                <span
                  className="slot-art"
                  style={
                    pl.rotation
                      ? { width: bh, height: bw, transform: 'translate(-50%, -50%) rotate(90deg)' }
                      : { width: bw, height: bh, transform: 'translate(-50%, -50%)' }
                  }
                >
                  <CoverThumb cover={cover} height={pl.rotation ? bw : bh} />
                </span>
              ) : (
                <span className="slot-empty">+</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="sheet-meta">
        <span className="sheet-title">
          <b>{String(index + 1).padStart(2, '0')}</b> {FORMATS[spec.formatId].name} sheet
        </span>
        <span className="queue-count">
          <Key size="sm" square onClick={() => update((s) => void (s.copies = Math.max(1, s.copies - 1)))} aria-label="Fewer copies">
            −
          </Key>
          <span className="lcd">×{spec.copies}</span>
          <Key size="sm" square onClick={() => update((s) => void (s.copies = Math.min(99, s.copies + 1)))} aria-label="More copies">
            +
          </Key>
        </span>
        <Key
          size="sm"
          onClick={() =>
            edit((p) => {
              p.sheets = p.sheets.filter((s) => s.id !== spec.id)
            })
          }
        >
          Remove
        </Key>
      </div>
      {picking !== null && (
        <div className="slot-picker">
          <span className="field-label">Slot {picking + 1} — choose a cover</span>
          <div className="slot-choices">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                className="cover-chip"
                aria-selected={spec.slots[picking] === c.id}
                onClick={() => {
                  update((s) => void (s.slots[picking] = c.id))
                  setPicking(null)
                }}
                title={c.name}
              >
                <CoverThumb cover={c} height={36} />
                <span>{String(covers.indexOf(c) + 1).padStart(2, '0')}</span>
              </button>
            ))}
            <button
              type="button"
              className="cover-chip slot-blank"
              aria-selected={spec.slots[picking] === null}
              onClick={() => {
                update((s) => void (s.slots[picking] = null))
                setPicking(null)
              }}
            >
              <span>Blank</span>
            </button>
          </div>
          {!choices.length && <p className="note">No {FORMATS[spec.formatId].name} covers yet.</p>}
        </div>
      )}
    </li>
  )
}

/** The print run: A4 sheets, the cover in each slot, and copies of each sheet. */
export function SheetsPanel() {
  const sheets = useDoc((s) => s.project.sheets)
  const project = useDoc((s) => s.project)
  const activeId = useDoc((s) => s.activeId)
  const edit = useDoc((s) => s.edit)
  const add = (formatId: FormatId) => {
    const active = project.covers.find((c) => c.id === activeId)
    const fill = active?.formatId === formatId ? active.id : (project.covers.find((c) => c.formatId === formatId)?.id ?? null)
    edit((p) => {
      p.sheets.push(newSheet(formatId, fill))
    })
  }
  return (
    <Panel num="07" it="FOGLI" en={`Sheets · ${pageCount(project)} page${pageCount(project) === 1 ? "" : "s"}`}>
      {sheets.length ? (
        <ul className="sheet-list">
          {sheets.map((s, i) => (
            <SheetCard key={s.id} spec={s} index={i} />
          ))}
        </ul>
      ) : (
        <div className="empty">
          <b>No sheets</b>
          Add a sheet, then tap its slots to choose covers.
        </div>
      )}
      <div className="grid-2">
        {FORMAT_IDS.map((f) => (
          <Key key={f} size="sm" onClick={() => add(f)}>
            + {FORMATS[f].name} sheet
          </Key>
        ))}
      </div>
      <p className="note">
        Tap a slot to put any cover in it — two <b>different</b> Notebooks can share a page. Squares print one per page.
      </p>
    </Panel>
  )
}
