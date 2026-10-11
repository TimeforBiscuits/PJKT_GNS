import { createStore, del, get, keys, set } from 'idb-keyval'
import type { Project } from '../model/doc'
import { migrateProject } from '../model/sheets'
import { useAssets, type Asset } from './assets'
import { useDoc } from './doc'
import { useEditor } from './editor'

// Autosave: the project and its pictures live in the browser's IndexedDB,
// so a refresh, a closed tab or a restart picks up where you left off.
// Nothing leaves the device. On iPad, add the app to the Home Screen so
// Safari keeps this storage (plain Safari tabs may clear it after weeks of
// disuse); a .gns project file is the durable backup.

const db = createStore('pjkt_gns', 'autosave')
const PROJECT = 'project'
const assetKey = (id: string) => `asset:${id}`

interface SavedProject {
  v: 1
  project: Project
  activeId: string
  savedAt: number
}

type SavedAsset = Omit<Asset, 'previewUrl'>

export const referencedAssets = (p: Project) =>
  new Set(p.covers.flatMap((c) => c.layers.flatMap((l) => (l.kind === 'image' ? [l.assetId] : []))))

export const isEmptyProject = (p: Project) => p.covers.every((c) => c.layers.length === 0)

let enabled = false
const saved = new Set<string>()

/** Load the last session, if any. */
export async function restore(): Promise<boolean> {
  try {
    const snap = await get<SavedProject>(PROJECT, db)
    enabled = true
    if (!snap || snap.v !== 1 || !snap.project?.covers?.length) return false
    const ids = referencedAssets(snap.project)
    const assets: Asset[] = []
    for (const id of ids) {
      const a = await get<SavedAsset>(assetKey(id), db)
      if (!a) continue
      assets.push({ ...a, previewUrl: URL.createObjectURL(a.preview) })
      saved.add(id)
    }
    useAssets.getState().replace(assets)
    useDoc.getState().loadProject(migrateProject(snap.project), snap.activeId)
    lastSaved.at = snap.savedAt
    return !isEmptyProject(snap.project)
  } catch {
    enabled = false
    return false
  }
}

export const lastSaved = { at: 0 }

async function save() {
  if (!enabled) return
  const { project, activeId } = useDoc.getState()
  const assets = useAssets.getState().assets
  const used = referencedAssets(project)
  try {
    for (const id of used) {
      if (saved.has(id) || !assets[id]) continue
      const { previewUrl: _url, ...rest } = assets[id]
      void _url
      await set(assetKey(id), rest satisfies SavedAsset, db)
      saved.add(id)
    }
    await set(PROJECT, { v: 1, project, activeId, savedAt: Date.now() } satisfies SavedProject, db)
    lastSaved.at = Date.now()
    useEditor.getState().setSavedAt(lastSaved.at)
    // Pictures no longer used anywhere are dropped from storage (they stay in
    // memory, so undo can still bring them back and they'd be saved again).
    for (const id of [...saved]) {
      if (used.has(id)) continue
      await del(assetKey(id), db)
      saved.delete(id)
    }
  } catch (e) {
    enabled = false
    useEditor.getState().flash(`Autosave stopped: ${(e as Error).message || 'storage is full or blocked'}. Save a project file.`)
  }
}

/** Save shortly after every change. */
export function startAutosave() {
  let t: ReturnType<typeof setTimeout> | null = null
  const schedule = () => {
    if (t) clearTimeout(t)
    t = setTimeout(() => void save(), 700)
  }
  const unsub = useDoc.subscribe((s, prev) => {
    if (s.project !== prev.project || s.activeId !== prev.activeId) schedule()
  })
  // Ask the browser not to evict our storage when space runs low.
  void navigator.storage?.persist?.().catch(() => undefined)
  return unsub
}

export const autosaveEnabled = () => enabled

/** Forget the autosaved session (New project). */
export async function clearAutosave() {
  try {
    for (const k of await keys(db)) await del(k, db)
    saved.clear()
  } catch {
    // nothing to clear
  }
}
