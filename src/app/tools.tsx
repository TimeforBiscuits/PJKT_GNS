import type { ReactNode } from 'react'
import { addImagesFromPicker } from '../editor/interact'
import { useEditor, type ToolId } from '../store/editor'
import {
  IconEllipse,
  IconHand,
  IconImage,
  IconLine,
  IconPolygon,
  IconRect,
  IconSelect,
  IconShush,
  IconText,
} from '../ui/icons'

/** A rail key: a tool to arm, or Image, which acts at once. */
export interface ToolDef {
  id: ToolId | 'image'
  label: string
  key: string
  icon: ReactNode
}

export const TOOL_GROUPS: ToolDef[][] = [
  [
    { id: 'select', label: 'Select', key: 'V', icon: <IconSelect /> },
    { id: 'hand', label: 'Hand', key: 'H', icon: <IconHand /> },
  ],
  [{ id: 'image', label: 'Image', key: 'I', icon: <IconImage /> }],
  [
    { id: 'rect', label: 'Rect', key: 'R', icon: <IconRect /> },
    { id: 'ellipse', label: 'Ellipse', key: 'E', icon: <IconEllipse /> },
    { id: 'polygon', label: 'Poly', key: 'P', icon: <IconPolygon /> },
    { id: 'line', label: 'Line', key: 'L', icon: <IconLine /> },
  ],
  [
    { id: 'text', label: 'Text', key: 'T', icon: <IconText /> },
    { id: 'censor', label: 'Secret', key: 'S', icon: <IconShush /> },
  ],
]

export const TOOLS: ToolDef[] = TOOL_GROUPS.flat()

/**
 * Press a rail key. Image isn't a mode: it opens the picker straight away,
 * while this press still counts as the user gesture browsers require, and
 * leaves Select armed whether or not anything is chosen. Tools only work on
 * a cover, so picking one from the sheet view goes back to the cover.
 */
export function pressTool(id: ToolDef['id']) {
  const ed = useEditor.getState()
  if (ed.view === 'sheet' && id !== 'select' && id !== 'hand') ed.setView('cover')
  if (id === 'image') {
    ed.setTool('select')
    void addImagesFromPicker()
  } else ed.setTool(id)
}
