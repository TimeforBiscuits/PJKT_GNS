import { useEffect, useState } from 'react'
import { useSheetLayout } from '../editor/scenes'
import { BLEED_MM, FORMATS } from '../model/formats'
import { useActiveCover, useDoc } from '../store/doc'
import { useEditor, type ToolId } from '../store/editor'

const HINTS: Record<ToolId, [string, string]> = {
  select: ['Select', 'tap to select · drag to move · full-bleed pictures drag to recompose · Space-drag or two fingers to pan'],
  hand: ['Hand', 'drag to pan · pinch or ⌘/Ctrl-scroll to zoom'],
  rect: ['Rectangle', 'drag to draw · Shift = square · Alt/⌥ = no snapping'],
  ellipse: ['Ellipse', 'drag to draw · Shift = circle · Alt/⌥ = no snapping'],
  polygon: ['Polygon', 'drag to draw · set the number of sides in the panel'],
  line: ['Line', 'drag to draw · Shift = 45° steps'],
  text: ['Text', 'tap the cover to place type'],
}

/** Messages stay up for a few seconds. */
const useRecentMessage = () => {
  const message = useEditor((s) => s.message)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setNow(Date.now()), 4500)
    return () => clearTimeout(t)
  }, [message])
  return message && now - message.at < 4500 ? message : null
}

const coord = (v: number) => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(1).padStart(5, '0')

export function StatusBar() {
  const cursor = useEditor((s) => s.cursor)
  const tool = useEditor((s) => s.tool)
  const view = useEditor((s) => s.view)
  const format = FORMATS[useActiveCover().formatId]
  const dpi = useEditor((s) => s.dpi)
  const perSheet = useSheetLayout().placements.length
  const contentEdit = useDoc((s) => s.contentEdit)
  const message = useRecentMessage()
  const [name, hint] =
    view === 'sheet'
      ? ['Sheet', 'A4 print preview — exactly as the PDF will lay out']
      : contentEdit
        ? ['Picture', 'drag to slide the picture inside its frame · cyan corners scale · double-tap or Esc when done']
        : HINTS[tool]

  return (
    <footer className="statusbar">
      <span className="lcd" aria-label="Pointer position in millimetres">
        <span className="unit">X</span>
        {cursor ? coord(cursor.x) : ' ———.—'}
        <span className="unit">Y</span>
        {cursor ? coord(cursor.y) : ' ———.—'}
        <span className="unit">mm</span>
      </span>
      {message ? (
        <span className={message.tone === 'alert' ? 'msg msg--alert' : 'msg msg--info'} role="status">
          <b>{message.tone === 'alert' ? '!' : '✓'}</b> {message.text}
        </span>
      ) : (
        <span className="msg">
          <b>{name}</b> — {hint}
        </span>
      )}
      <span className="meta">
        {format.name} · {perSheet}/A4 · bleed {BLEED_MM.toFixed(1)} · {dpi} dpi · v0.1
      </span>
    </footer>
  )
}
