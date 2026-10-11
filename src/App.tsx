import { CalibrateDialog } from './app/CalibrateDialog'
import { Inspector } from './app/Inspector'
import { StatusBar } from './app/StatusBar'
import { ToolRail } from './app/ToolRail'
import { TopBar } from './app/TopBar'
import { useShortcuts } from './app/shortcuts'
import { CoverScene } from './editor/CoverScene'
import { COVER_FIT_PAD, SHEET_FIT_BOUNDS, SHEET_FIT_PAD, coverFitBounds } from './editor/scenes'
import { SheetScene } from './editor/SheetScene'
import { Viewport } from './editor/Viewport'
import { useEditor } from './store/editor'

export default function App() {
  useShortcuts()
  const view = useEditor((s) => s.view)
  const formatId = useEditor((s) => s.formatId)
  const calibrating = useEditor((s) => s.calibrating)

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <ToolRail />
        <main style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'grid' }}>
          {view === 'cover' ? (
            <Viewport key="cover" fitBounds={coverFitBounds(formatId)} fitPad={COVER_FIT_PAD}>
              {(v) => <CoverScene {...v} />}
            </Viewport>
          ) : (
            <Viewport key="sheet" fitBounds={SHEET_FIT_BOUNDS} fitPad={SHEET_FIT_PAD}>
              {(v) => <SheetScene {...v} />}
            </Viewport>
          )}
          <Legend />
        </main>
        <Inspector />
      </div>
      <StatusBar />
      {calibrating && <CalibrateDialog />}
    </div>
  )
}

function Legend() {
  const view = useEditor((s) => s.view)
  const demo = useEditor((s) => s.demoArt)
  return (
    <div className="view-badge">
      {demo && <span className="tag" style={{ color: 'var(--signal)' }}>Demo art</span>}
      <span className="tag">
        <span className="swatch" style={{ background: 'var(--guide-trim)' }} />
        Trim
      </span>
      {view === 'cover' ? (
        <>
          <span className="tag">
            <span className="swatch" style={{ background: 'var(--guide-safe)' }} />
            Safe
          </span>
          <span className="tag">
            <span className="swatch" style={{ background: 'var(--guide-bleed)' }} />
            Bleed
          </span>
          <span className="tag">
            <span className="swatch" style={{ background: 'repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 4px)' }} />
            Fold
          </span>
        </>
      ) : (
        <span className="tag">
          <span className="swatch" style={{ background: 'repeating-linear-gradient(-45deg,#8f8a7f 0 2px,transparent 2px 4px)', height: 10 }} />
          No-print
        </span>
      )}
    </div>
  )
}
