import { useState } from 'react'
import { buildCoversPdf, buildTestPdf, coverFileName } from '../../pdf/export'
import { canPickSaveLocation, deliver, pickSaveLocation, writeTo, type Writable } from '../files'
import { Key } from '../../ui/controls'
import { IconPrint } from '../../ui/icons'

type State =
  | { phase: 'idle' }
  | { phase: 'busy'; msg: string }
  | { phase: 'ready'; file: File }
  | { phase: 'done'; msg: string }
  | { phase: 'error'; msg: string }

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`

/** Build the PDF, then save it where the user chooses. */
export function ExportControls() {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const busy = state.phase === 'busy'

  const run = async (kind: 'covers' | 'test') => {
    // Chrome and Edge ask where to save first, while the click still counts as
    // a user gesture; other browsers hand over the finished file afterwards.
    let handle: Writable | null = null
    if (canPickSaveLocation()) {
      try {
        handle = await pickSaveLocation(kind === 'covers' ? coverFileName() : 'PJKT_GNS-printer-test.pdf', 'PDF', {
          'application/pdf': ['.pdf'],
        })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    setState({ phase: 'busy', msg: 'Starting' })
    try {
      const built = kind === 'covers' ? await buildCoversPdf((msg) => setState({ phase: 'busy', msg })) : await buildTestPdf()
      if (handle) {
        await writeTo(handle, built.file)
        setState({ phase: 'done', msg: `Saved · ${built.sheets} sheet${built.sheets === 1 ? '' : 's'} · ${mb(built.file.size)}` })
      } else setState({ phase: 'ready', file: built.file })
    } catch (e) {
      setState({ phase: 'error', msg: e instanceof Error ? e.message : 'The PDF could not be made.' })
    }
  }

  return (
    <div className="export">
      <Key variant="signal" disabled={busy} onClick={() => void run('covers')}>
        <IconPrint />
        {busy ? 'Working…' : 'Export PDF'}
      </Key>
      {state.phase !== 'idle' && (
        <span className={state.phase === 'error' ? 'lcd lcd--warn' : 'lcd'} role="status">
          {state.phase === 'busy' && `${state.msg.toUpperCase()}…`}
          {state.phase === 'ready' && `READY · ${mb(state.file.size)}`}
          {state.phase === 'done' && state.msg.toUpperCase()}
          {state.phase === 'error' && state.msg}
        </span>
      )}
      {state.phase === 'ready' && (
        <Key variant="ink" onClick={() => void deliver(state.file).then(() => setState({ phase: 'done', msg: state.file.name }))}>
          {navigator.maxTouchPoints > 1 ? 'Save to Files…' : 'Download PDF'}
        </Key>
      )}
      <Key size="sm" disabled={busy} onClick={() => void run('test')} title="One page with a 100 mm square, rulers and edge gauges">
        Printer test page
      </Key>
    </div>
  )
}
