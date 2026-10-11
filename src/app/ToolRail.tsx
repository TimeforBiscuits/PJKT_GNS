import { Fragment } from 'react'
import { useEditor } from '../store/editor'
import { Key, Led } from '../ui/controls'
import { TOOL_GROUPS, pressTool } from './tools'

export function ToolRail() {
  const tool = useEditor((s) => s.tool)
  return (
    <nav className="rail" aria-label="Tools">
      {TOOL_GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <div className="rail-groove" />}
          {group.map((t) => (
            <Key
              key={t.id}
              className="tool"
              pressed={t.id === 'image' ? undefined : tool === t.id}
              onClick={() => pressTool(t.id)}
              title={t.id === 'image' ? `Import pictures (${t.key})` : `${t.label} (${t.key})`}
            >
              <Led on={tool === t.id} />
              <span className="shortcut">{t.key}</span>
              {t.icon}
              {t.label}
            </Key>
          ))}
        </Fragment>
      ))}
    </nav>
  )
}
