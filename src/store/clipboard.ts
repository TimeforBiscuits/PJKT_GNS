import { create } from 'zustand'
import type { Layer } from '../model/doc'
import { selectedLayer, useDoc } from './doc'

// Copy and paste of whole layers: size, type, formatting and effects travel
// with the copy. Kept inside the app; the system clipboard only gets a marker,
// so a later ⌘V knows whether you last copied a layer here or a picture
// somewhere else.

export const CLIP_MARK = 'pjkt_gns:layer'

interface ClipState {
  layer: Layer | null
}

export const useClipboard = create<ClipState>(() => ({ layer: null }))

const mark = () => {
  try {
    void navigator.clipboard?.writeText(CLIP_MARK).catch(() => {})
  } catch {
    // no clipboard access: in-app paste still works
  }
}

export function copySelection(): boolean {
  const l = selectedLayer()
  if (!l) return false
  useClipboard.setState({ layer: structuredClone(l) })
  mark()
  return true
}

export function cutSelection(): boolean {
  const l = selectedLayer()
  if (!l || l.locked || !copySelection()) return false
  useDoc.getState().removeLayer(l.id)
  return true
}

export function pasteClipboard(): boolean {
  const l = useClipboard.getState().layer
  if (!l) return false
  useDoc.getState().pasteLayer(l)
  return true
}
