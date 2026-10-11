import type { TextLayer } from '../../model/doc'
import { Panel } from '../../ui/controls'

export function TextPanel({ layer }: { layer: TextLayer }) {
  return (
    <Panel num="03" it="TESTO" en="Type">
      <p className="note">{layer.text}</p>
    </Panel>
  )
}

export function TextToolPanel() {
  return (
    <Panel num="03" it="TESTO" en="Type">
      <p className="note">Tap the cover to place text.</p>
    </Panel>
  )
}
