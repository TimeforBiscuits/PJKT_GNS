import type { Layer } from '../../model/doc'
import { useActiveCover, useDoc } from '../../store/doc'
import { sampleLayers } from '../../editor/sample'
import { Key, Panel } from '../../ui/controls'
import { IconEllipse, IconImage, IconLine, IconPolygon, IconRect, IconText } from '../../ui/icons'

const icon = (l: Layer) => {
  if (l.kind === 'image') return <IconImage />
  if (l.kind === 'text') return <IconText />
  return { rect: <IconRect />, ellipse: <IconEllipse />, polygon: <IconPolygon />, line: <IconLine /> }[l.shape]
}

/** Unnamed text layers go by their first line. */
const displayName = (l: Layer) =>
  l.kind === 'text' && l.name === 'Text' ? l.text.split('\n')[0].trim().slice(0, 32) || 'Text' : l.name

/** The cover's stack, topmost first. */
export function LayersPanel() {
  const cover = useActiveCover()
  const selectedId = useDoc((s) => s.selectedId)
  const select = useDoc((s) => s.select)
  const update = useDoc((s) => s.updateLayer)
  const layers = [...cover.layers].reverse()
  const edit = useDoc((s) => s.edit)
  const addSample = () =>
    edit((_, c) => {
      c.layers.push(...sampleLayers(c))
    })

  return (
    <Panel num="05" it="LIVELLI" en={`Layers · ${layers.length}`}>
      {layers.length === 0 ? (
        <>
          <div className="empty">
            <b>No layers yet</b>
            Import an image (I), draw a shape (R · E · P · L) or set some type (T).
          </div>
          <Key size="sm" onClick={addSample}>
            Start from a sample layout
          </Key>
        </>
      ) : (
        <ul className="layer-list">
          {layers.map((l) => (
            <li key={l.id} className={l.id === selectedId ? 'layer-row is-selected' : 'layer-row'}>
              <button type="button" className="layer-pick" onClick={() => select(l.id)} aria-pressed={l.id === selectedId}>
                <span className="layer-icon">{icon(l)}</span>
                <span className="layer-title" style={{ opacity: l.hidden ? 0.45 : 1 }}>
                  {displayName(l)}
                </span>
              </button>
              <button
                type="button"
                className={l.hidden ? 'layer-flag' : 'layer-flag is-on'}
                aria-label={l.hidden ? 'Show layer' : 'Hide layer'}
                title={l.hidden ? 'Hidden — tap to show' : 'Visible — tap to hide'}
                onClick={() => update(l.id, { hidden: !l.hidden })}
              >
                {l.hidden ? '—' : '◉'}
              </button>
              <button
                type="button"
                className={l.locked ? 'layer-flag is-lock' : 'layer-flag'}
                aria-label={l.locked ? 'Unlock layer' : 'Lock layer'}
                title={l.locked ? 'Locked — tap to unlock' : 'Unlocked — tap to lock'}
                onClick={() => update(l.id, { locked: !l.locked })}
              >
                {l.locked ? '■' : '□'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
