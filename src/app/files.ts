// Getting files out of the browser on each platform.

export const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export interface Writable {
  createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<Writable>
}

/** Chrome and Edge can ask where to save (must be called straight from a click). */
export const canPickSaveLocation = () => typeof (window as SaveFilePickerWindow).showSaveFilePicker === 'function'

export const pickSaveLocation = (name: string, description: string, accept: Record<string, string[]>) =>
  (window as SaveFilePickerWindow).showSaveFilePicker!({ suggestedName: name, types: [{ description, accept }] })

export async function writeTo(handle: Writable, file: Blob) {
  const out = await handle.createWritable()
  await out.write(file)
  await out.close()
}

/** Hand a finished file to the user: the share sheet on iPad (Save to Files), a download elsewhere. */
export async function deliver(file: File) {
  const touch = navigator.maxTouchPoints > 1
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
