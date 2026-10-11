import { useState } from 'react'
import { newCover } from '../../model/doc'
import { newSheet } from '../../model/sheets'
import { useAssets } from '../../store/assets'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { autosaveEnabled } from '../../store/persist'
import { pickProjectFile, readProjectFile, writeProjectFile } from '../../store/projectFile'
import { Key, Panel } from '../../ui/controls'
import { baseName, canPickSaveLocation, deliver, pickSaveLocation, writeTo, type Writable } from '../files'
import { FileNameField } from './FileNameField'

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Autosave status and project files (.gns) for moving work between devices. */
export function ProjectPanel() {
  const savedAt = useEditor((s) => s.savedAt)
  const flash = useEditor((s) => s.flash)
  const requestFit = useEditor((s) => s.requestFit)
  const [confirmNew, setConfirmNew] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const name = baseName(useDoc.getState().project.name, 'project')
    let handle: Writable | null = null
    if (canPickSaveLocation()) {
      try {
        handle = await pickSaveLocation(`${name}.gns`, 'PJKT_GNS project', { 'application/zip': ['.gns'] })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    setBusy(true)
    try {
      const file = await writeProjectFile(name)
      if (handle) await writeTo(handle, file)
      else await deliver(file)
      flash(`Project saved · ${(file.size / 1024 / 1024).toFixed(1)} MB`, 'info')
    } catch (e) {
      flash(`Could not save the project: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const open = async () => {
    const file = await pickProjectFile()
    if (!file) return
    setBusy(true)
    try {
      await readProjectFile(file)
      useEditor.getState().setView('cover')
      requestFit()
      flash(`Opened ${file.name}`, 'info')
    } catch (e) {
      flash((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startNew = () => {
    const c = newCover('notebook', 1)
    useAssets.getState().replace([])
    useDoc.getState().loadProject({ covers: [c], sheets: [newSheet('notebook', c.id)] })
    setConfirmNew(false)
    requestFit()
  }

  return (
    <Panel num="08" it="PROGETTO" en="Project">
      <span className="lcd" role="status">
        {autosaveEnabled() ? (savedAt ? `AUTOSAVED ${clock(savedAt)}` : 'AUTOSAVE ON') : 'AUTOSAVE OFF IN THIS BROWSER MODE'}
      </span>
      <FileNameField ext="gns" kind="project" />
      <div className="grid-2">
        <Key size="sm" disabled={busy} onClick={() => void save()} title="Everything, pictures included, in one .gns file">
          Save file
        </Key>
        <Key size="sm" disabled={busy} onClick={() => void open()} title="Open a .gns project file">
          Open file
        </Key>
      </div>
      {confirmNew ? (
        <div className="grid-2">
          <Key size="sm" variant="signal" onClick={startNew}>
            Clear all
          </Key>
          <Key size="sm" onClick={() => setConfirmNew(false)}>
            Keep
          </Key>
        </div>
      ) : (
        <Key size="sm" onClick={() => setConfirmNew(true)}>
          New project…
        </Key>
      )}
      <p className="note">
        Work saves itself in this browser. Use <b>Save file</b> to move a project between the Mac, the PC and the iPad, or
        to keep a backup.
      </p>
    </Panel>
  )
}
