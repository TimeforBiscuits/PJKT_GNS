import { useEditor } from '../store/editor'
import { restore, startAutosave } from '../store/persist'

/** Restores the last session, then starts autosaving. Resolves true if there was work to bring back. */
export const booted: Promise<boolean> = restore()
  .catch(() => false)
  .then((had) => {
    startAutosave()
    if (had) useEditor.getState().requestFit()
    return had
  })
