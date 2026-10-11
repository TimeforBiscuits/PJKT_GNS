import { useSheetLayout } from '../editor/scenes'
import { BLEED_MM, FORMATS } from '../model/formats'
import { useEditor, type ToolId } from '../store/editor'

const HINTS: Record<ToolId, [string, string]> = {
  select: ['Select', 'pick and move objects · Space-drag or two fingers to pan · pinch or ⌘/Ctrl-scroll to zoom'],
  hand: ['Hand', 'drag to pan · pinch or ⌘/Ctrl-scroll to zoom'],
  image: ['Image', 'import and full-bleed placement arrive in the next build'],
  rect: ['Rectangle', 'drawing arrives in the shapes build — style settings are kept'],
  ellipse: ['Ellipse', 'drawing arrives in the shapes build — style settings are kept'],
  polygon: ['Polygon', 'drawing arrives in the shapes build — style settings are kept'],
  line: ['Line', 'drawing arrives in the shapes build — style settings are kept'],
  text: ['Text', 'type tools and the font library arrive in the type build'],
}

const coord = (v: number) => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(1).padStart(5, '0')

export function StatusBar() {
  const cursor = useEditor((s) => s.cursor)
  const tool = useEditor((s) => s.tool)
  const view = useEditor((s) => s.view)
  const format = FORMATS[useEditor((s) => s.formatId)]
  const dpi = useEditor((s) => s.dpi)
  const perSheet = useSheetLayout().placements.length
  const [name, hint] = view === 'sheet' ? ['Sheet', 'A4 print preview — exactly as the PDF will lay out'] : HINTS[tool]

  return (
    <footer className="statusbar">
      <span className="lcd" aria-label="Pointer position in millimetres">
        <span className="unit">X</span>
        {cursor ? coord(cursor.x) : ' ———.—'}
        <span className="unit">Y</span>
        {cursor ? coord(cursor.y) : ' ———.—'}
        <span className="unit">mm</span>
      </span>
      <span className="msg">
        <b>{name}</b> — {hint}
      </span>
      <span className="meta">
        {format.name} · {perSheet}/A4 · bleed {BLEED_MM.toFixed(1)} · {dpi} dpi · v0.1
      </span>
    </footer>
  )
}
