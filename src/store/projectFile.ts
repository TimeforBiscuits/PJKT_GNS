import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import type { Project } from '../model/doc'
import { useAssets, type Asset } from './assets'
import { useDoc } from './doc'
import { referencedAssets } from './persist'

// A .gns project file is an ordinary zip: project.json plus the original
// pictures, untouched, and their screen previews. Move it between the
// MacBook, the PC and the iPad, or keep it as a backup.

interface Manifest {
  app: 'PJKT_GNS'
  v: 1
  project: Project
  activeId: string
  assets: { id: string; name: string; type: string; width: number; height: number; hasAlpha: boolean; file: string; preview: string }[]
}

const ext = (type: string) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('heic') ? 'heic' : type.includes('tif') ? 'tif' : 'jpg')

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

export async function writeProjectFile(name: string): Promise<File> {
  const { project, activeId } = useDoc.getState()
  const all = useAssets.getState().assets
  const entries: Zippable = {}
  const assets: Manifest['assets'] = []
  for (const id of referencedAssets(project)) {
    const a = all[id]
    if (!a) continue
    const type = a.blob.type || 'image/jpeg'
    const file = `assets/${id}.${ext(type)}`
    const preview = `previews/${id}.${a.preview.type.includes('png') ? 'png' : 'jpg'}`
    // Pictures are already compressed: store them, don't deflate again.
    entries[file] = [await bytes(a.blob), { level: 0 }]
    entries[preview] = [await bytes(a.preview), { level: 0 }]
    assets.push({ id, name: a.name, type, width: a.width, height: a.height, hasAlpha: a.hasAlpha, file, preview })
  }
  const manifest: Manifest = { app: 'PJKT_GNS', v: 1, project, activeId, assets }
  entries['project.json'] = strToU8(JSON.stringify(manifest, null, 1))
  const zip = zipSync(entries)
  return new File([zip as BlobPart], `${name}.gns`, { type: 'application/zip' })
}

export async function readProjectFile(file: File) {
  const files = unzipSync(await bytes(file))
  const raw = files['project.json']
  if (!raw) throw new Error('That isn’t a PJKT_GNS project file.')
  const m = JSON.parse(strFromU8(raw)) as Manifest
  if (m.app !== 'PJKT_GNS' || !m.project?.covers?.length) throw new Error('That project file is damaged or from another app.')
  const assets: Asset[] = m.assets.map((a) => {
    const blob = new Blob([files[a.file] as BlobPart], { type: a.type })
    const preview = new Blob([files[a.preview] as BlobPart], { type: a.preview.endsWith('png') ? 'image/png' : 'image/jpeg' })
    return { id: a.id, name: a.name, blob, width: a.width, height: a.height, hasAlpha: a.hasAlpha, preview, previewUrl: URL.createObjectURL(preview) }
  })
  useAssets.getState().replace(assets)
  useDoc.getState().loadProject(m.project, m.activeId)
}

export const pickProjectFile = () =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    // iPad's Files picker greys out unknown extensions unless zip is allowed too.
    input.accept = '.gns,application/zip'
    input.style.display = 'none'
    document.body.appendChild(input)
    let done = false
    const finish = (f: File | null) => {
      if (done) return
      done = true
      input.remove()
      resolve(f)
    }
    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => finish(null))
    input.click()
  })
