import { CoverThumb } from '../../editor/CoverThumb'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { Key, Panel } from '../../ui/controls'

/** Every cover design in the project; tap to open one. */
export function CoversPanel() {
  const covers = useDoc((s) => s.project.covers)
  const activeId = useDoc((s) => s.activeId)
  const open = useDoc((s) => s.openCover)
  const add = useDoc((s) => s.addCover)
  const duplicate = useDoc((s) => s.duplicateCover)
  const remove = useDoc((s) => s.deleteCover)
  const requestFit = useEditor((s) => s.requestFit)
  const active = covers.find((c) => c.id === activeId)!

  return (
    <Panel num="06" it="COPERTINE" en="Covers">
      <div className="cover-strip" role="listbox" aria-label="Covers">
        {covers.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={c.id === activeId}
            className="cover-chip"
            onClick={() => {
              if (c.id === activeId) return
              open(c.id)
              requestFit()
            }}
            title={c.name}
          >
            <CoverThumb cover={c} height={44} />
            <span>{String(i + 1).padStart(2, '0')}</span>
          </button>
        ))}
      </div>
      <div className="grid-3">
        <Key size="sm" onClick={() => (add(active.formatId), requestFit())} title="New blank cover">
          + New
        </Key>
        <Key size="sm" onClick={() => duplicate(activeId)} title="Duplicate this cover">
          Dup
        </Key>
        <Key size="sm" disabled={covers.length < 2} onClick={() => remove(activeId)} title="Delete this cover">
          Del
        </Key>
      </div>
    </Panel>
  )
}
