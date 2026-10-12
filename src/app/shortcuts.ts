import { useEffect } from 'react'
import { zoomActual, zoomIn, zoomOut } from '../editor/camera'
import { addImages } from '../editor/interact'
import type { ImageLayer } from '../model/doc'
import { selectedLayer, useDoc } from '../store/doc'
import { CLIP_MARK, copySelection, cutSelection, pasteClipboard, useClipboard } from '../store/clipboard'
import { useEditor } from '../store/editor'
import { isMod } from './platform'
import { TOOLS, pressTool } from './tools'

/** Text input types, where keys (and ⌘Z) belong to the field. */
const TEXT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password'])

// Only fields you type into keep the keys to themselves. A slider or a
// checkbox that still has focus after a drag must not swallow ⌘Z.
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  ((t instanceof HTMLInputElement && TEXT_TYPES.has(t.type)) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)

/** Desktop and iPad Magic Keyboard shortcuts. */
export function useShortcuts() {
  useEffect(() => {
    // ⌘V pastes a copied layer unless the clipboard turns out to hold
    // pictures copied elsewhere (the paste event, if any, follows the key).
    let pasteTimer = 0
    const pasteLayerSoon = () => {
      clearTimeout(pasteTimer)
      pasteTimer = window.setTimeout(() => {
        pasteTimer = 0
        if (useEditor.getState().view === 'cover') pasteClipboard()
      }, 60)
    }

    const onKey = (e: KeyboardEvent) => {
      const ed = useEditor.getState()
      const doc = useDoc.getState()
      if (e.key === 'Escape' && ed.calibrating) {
        ed.setCalibrating(false)
        return
      }
      if (typing(e.target) || ed.calibrating) return
      const mod = isMod(e)
      const sel = selectedLayer()
      const key = e.key.toLowerCase()

      if (mod) {
        if (key === 'z' && !e.shiftKey) doc.undo()
        else if ((key === 'z' && e.shiftKey) || key === 'y') doc.redo()
        else if (key === '0') ed.requestFit()
        else if (key === '1') zoomActual()
        else if (key === '=' || key === '+') zoomIn()
        else if (key === '-') zoomOut()
        else if (key === 'd' && sel) doc.duplicateLayer(sel.id)
        else if (key === 'c' && sel && ed.view === 'cover') copySelection()
        else if (key === 'x' && sel && ed.view === 'cover') cutSelection()
        else if (key === 'v' && useClipboard.getState().layer) {
          // no preventDefault: the browser still raises its paste event
          pasteLayerSoon()
          return
        }
        // By key position: Shift turns [ and ] into { and } on most layouts.
        else if (e.code === 'BracketRight' && sel) doc.restack(sel.id, e.shiftKey ? 'top' : 'up')
        else if (e.code === 'BracketLeft' && sel) doc.restack(sel.id, e.shiftKey ? 'bottom' : 'down')
        else return
        e.preventDefault()
        return
      }
      // Ctrl on a Mac (or ⌘ on Windows) isn't a shortcut here: don't let it pick tools.
      if (e.metaKey || e.ctrlKey) return

      if (ed.view === 'cover' && sel) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          if (!sel.locked) doc.removeLayer(sel.id)
          e.preventDefault()
          return
        }
        if (e.key === 'Enter') {
          if (sel.kind === 'image') doc.setContentEdit(!doc.contentEdit)
          if (sel.kind === 'text') ed.focusText()
          e.preventDefault()
          return
        }
        const step = e.altKey ? 0.1 : e.shiftKey ? 5 : 0.5
        const arrows: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }
        const d = arrows[e.key]
        if (d && !sel.locked) {
          e.preventDefault()
          if (sel.kind === 'image' && doc.contentEdit) {
            const c = sel.content
            doc.updateLayer<ImageLayer>(sel.id, { content: { ...c, x: c.x + d[0], y: c.y + d[1] } })
          } else doc.updateLayer(sel.id, { x: sel.x + d[0], y: sel.y + d[1] })
          return
        }
      }

      if (e.key === 'Escape') {
        if (doc.contentEdit) doc.setContentEdit(false)
        else if (doc.selectedId) doc.select(null)
        else ed.setTool('select')
        return
      }
      // A held key repeats: arm a tool (or open the picker) once.
      if (e.altKey || e.repeat) return
      const tool = TOOLS.find((t) => t.key.toLowerCase() === key)
      if (tool) pressTool(tool.id)
    }

    // Paste pictures straight from the clipboard (desktop).
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e.target)) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      const ours = e.clipboardData?.getData('text/plain') === CLIP_MARK
      if (!files.length || ours) return
      // Pictures copied elsewhere win over a layer copied here earlier.
      clearTimeout(pasteTimer)
      pasteTimer = 0
      e.preventDefault()
      useEditor.getState().setView('cover')
      void addImages(files)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}
