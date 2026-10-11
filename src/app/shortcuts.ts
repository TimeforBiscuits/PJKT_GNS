import { useEffect } from 'react'
import { zoomActual, zoomIn, zoomOut } from '../editor/camera'
import { useEditor } from '../store/editor'
import { TOOLS } from './tools'

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

/** Desktop and iPad Magic Keyboard shortcuts. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState()
      if (e.key === 'Escape' && s.calibrating) {
        s.setCalibrating(false)
        return
      }
      if (typing(e.target) || s.calibrating) return
      const mod = e.metaKey || e.ctrlKey
      if (mod) {
        if (e.key === '0') s.requestFit()
        else if (e.key === '1') zoomActual()
        else if (e.key === '=' || e.key === '+') zoomIn()
        else if (e.key === '-') zoomOut()
        else return
        e.preventDefault()
        return
      }
      if (e.altKey) return
      const tool = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase())
      if (tool) s.setTool(tool.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
