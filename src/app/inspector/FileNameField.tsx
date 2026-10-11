import { useState } from 'react'
import { useDoc } from '../../store/doc'
import { baseName, cleanFileName } from '../files'

/**
 * The name exported files get. One name serves the PDF and the project
 * file; left empty, files are named by date.
 */
export function FileNameField({ ext, kind }: { ext: 'pdf' | 'gns'; kind: 'covers' | 'project' }) {
  const name = useDoc((s) => s.project.name ?? '')
  const edit = useDoc((s) => s.edit)
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null)
  const text = draft && draft.base === name ? draft.text : name

  const commit = () => {
    if (!draft) return
    const clean = cleanFileName(draft.text)
    setDraft(null)
    if (clean !== name)
      edit((p) => {
        p.name = clean
      })
  }

  return (
    <label className="field file-name">
      <span className="field-label">File name</span>
      <span className="lcd">
        <input
          value={text}
          placeholder={baseName('', kind)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="done"
          onChange={(e) => setDraft({ text: e.target.value, base: name })}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setDraft(null)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        <span className="unit">.{ext}</span>
      </span>
    </label>
  )
}
