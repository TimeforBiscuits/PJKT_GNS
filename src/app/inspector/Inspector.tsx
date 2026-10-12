import { useDoc, useSelectedLayer } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { CensorPanel } from './CensorPanel'
import { CoversPanel } from './CoversPanel'
import { DocumentPanel } from './DocumentPanel'
import { EditStrip } from './EditStrip'
import { EffectsPanel } from './EffectsPanel'
import { ImagePanel } from './ImagePanel'
import { LayersPanel } from './LayersPanel'
import { PrintPanel, SheetsPanel } from './PrintPanel'
import { ProjectPanel } from './ProjectPanel'
import { ShapePanel, ShapeToolPanel } from './ShapePanel'
import { TextPanel, TextToolPanel } from './TextPanel'
import { TransformPanel } from './TransformPanel'

export function Inspector() {
  const view = useEditor((s) => s.view)
  const tool = useEditor((s) => s.tool)
  const layer = useSelectedLayer()
  const selectedId = useDoc((s) => s.selectedId)

  if (view === 'sheet')
    return (
      <aside className="inspector" aria-label="Inspector">
        <EditStrip />
        <PrintPanel />
        <SheetsPanel />
      </aside>
    )

  const drawing = tool === 'rect' || tool === 'ellipse' || tool === 'polygon' || tool === 'line'
  return (
    <aside className="inspector" aria-label="Inspector">
      <EditStrip />
      <CoversPanel />
      {layer ? (
        <>
          <TransformPanel key={`t-${selectedId}`} layer={layer} />
          {layer.kind === 'image' && <ImagePanel layer={layer} />}
          {layer.kind === 'shape' && <ShapePanel layer={layer} />}
          {layer.kind === 'text' && <TextPanel layer={layer} />}
          {layer.kind === 'censor' && <CensorPanel layer={layer} />}
          <EffectsPanel layer={layer} />
        </>
      ) : (
        <>
          {drawing && <ShapeToolPanel />}
          {tool === 'text' && <TextToolPanel />}
          <DocumentPanel />
        </>
      )}
      <LayersPanel />
      {!layer && <ProjectPanel />}
    </aside>
  )
}
