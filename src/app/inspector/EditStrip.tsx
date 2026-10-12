import { copySelection, pasteClipboard, useClipboard } from '../../store/clipboard'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { Key } from '../../ui/controls'
import { IconCopy, IconPaste, IconRedo, IconUndo } from '../../ui/icons'
import { MOD } from '../platform'

/** Finish typing in a field first: on iPad a key press doesn't take focus from it. */
const settle = () => {
  const f = document.activeElement
  if (f instanceof HTMLElement && f !== document.body) f.blur()
}

/** Undo, redo, copy and paste, pinned to the top of the inspector. */
export function EditStrip() {
  const canUndo = useDoc((s) => s.past.length > 0 || (!!s.pending && s.pending.project !== s.project))
  const canRedo = useDoc((s) => s.future.length > 0)
  const selected = useDoc((s) => !!s.selectedId)
  const clip = useClipboard((s) => s.layer)
  const onCover = useEditor((s) => s.view === 'cover')
  const flash = useEditor((s) => s.flash)

  return (
    <div className="edit-strip" role="toolbar" aria-label="Edit">
      <Key
        disabled={!canUndo}
        onClick={() => {
          settle()
          useDoc.getState().undo()
        }}
        title={`Undo (${MOD}Z)`}
      >
        <IconUndo />
        Undo
      </Key>
      <Key
        disabled={!canRedo}
        onClick={() => {
          settle()
          useDoc.getState().redo()
        }}
        title={`Redo (${MOD}⇧Z)`}
      >
        <IconRedo />
        Redo
      </Key>
      <Key
        disabled={!onCover || !selected}
        onClick={() => {
          settle()
          if (copySelection()) flash('Copied — paste it onto any cover', 'info')
        }}
        title={`Copy the selected layer (${MOD}C)`}
      >
        <IconCopy />
        Copy
      </Key>
      <Key
        disabled={!onCover || !clip}
        onClick={() => {
          settle()
          pasteClipboard()
        }}
        title={`Paste (${MOD}V)`}
      >
        <IconPaste />
        Paste
      </Key>
    </div>
  )
}
