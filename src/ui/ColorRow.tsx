import { useRef, useState } from 'react'

const SWATCHES = ['#111111', '#ffffff', '#ff4f00', '#e8e4da', '#8f8a7f', '#0038ff']

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

const normHex = (v: string) => {
  const m = v.trim().match(HEX)
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}

/** Swatches, a custom picker and an editable hex readout. `null` means none. */
export function ColorRow({
  label,
  value,
  onChange,
  allowNone = true,
}: {
  label: string
  value: string | null
  onChange: (c: string | null) => void
  allowNone?: boolean
}) {
  const picker = useRef<HTMLInputElement>(null)
  const [edit, setEdit] = useState<{ text: string; base: string | null } | null>(null)
  const draft = edit && edit.base === value ? edit.text : null
  const commit = (raw: string) => {
    const h = normHex(raw)
    if (h) onChange(h)
    setEdit(null)
  }
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="swatches">
        {allowNone && (
          <button
            type="button"
            className="swatch-key swatch-none"
            aria-label={`No ${label.toLowerCase()}`}
            aria-pressed={value === null}
            onClick={() => onChange(null)}
          />
        )}
        {SWATCHES.slice(0, allowNone ? 6 : 7).map((c) => (
          <button
            key={c}
            type="button"
            className="swatch-key"
            style={{ background: c }}
            aria-label={c}
            aria-pressed={value?.toLowerCase() === c}
            onClick={() => onChange(c)}
          />
        ))}
        <button
          type="button"
          className="swatch-key"
          style={{ background: 'conic-gradient(#ff4f00, #ffd400, #00b39f, #0038ff, #ff2a8a, #ff4f00)' }}
          aria-label={`Custom ${label.toLowerCase()} colour`}
          onClick={() => picker.current?.click()}
        />
        <input
          ref={picker}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          value={value ?? '#111111'}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <span className="lcd">
        <span className="unit">HEX</span>
        {value === null && draft === null ? (
          <input value="— NONE —" readOnly onFocus={() => setEdit({ text: '#', base: value })} />
        ) : (
          <input
            value={draft ?? value!.toUpperCase()}
            spellCheck={false}
            autoCapitalize="characters"
            onChange={(e) => setEdit({ text: e.target.value, base: value })}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        )}
        {value && <span style={{ width: 12, height: 12, flex: 'none', alignSelf: 'center', background: value, border: '1px solid var(--lcd)' }} />}
      </span>
    </div>
  )
}
