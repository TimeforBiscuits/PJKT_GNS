import type { ReactNode } from 'react'
import type { ToolId } from '../store/editor'
import {
  IconEllipse,
  IconHand,
  IconImage,
  IconLine,
  IconPolygon,
  IconRect,
  IconSelect,
  IconText,
} from '../ui/icons'

export interface ToolDef {
  id: ToolId
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
  [{ id: 'text', label: 'Text', key: 'T', icon: <IconText /> }],
]

export const TOOLS: ToolDef[] = TOOL_GROUPS.flat()
