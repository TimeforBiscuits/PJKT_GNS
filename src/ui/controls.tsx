import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

type KeyProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'plain' | 'signal' | 'ink'
  size?: 'md' | 'sm'
  square?: boolean
  pressed?: boolean
}

/** The chunky hardware key every button in the app is built from. */
export function Key({ variant = 'plain', size = 'md', square, pressed, className, ...rest }: KeyProps) {
  const cls = ['key']
  if (variant !== 'plain') cls.push(`key--${variant}`)
  if (size === 'sm') cls.push('key--sm')
  if (square) cls.push('key--sq')
  if (className) cls.push(className)
  return <button type="button" className={cls.join(' ')} aria-pressed={pressed} {...rest} />
}

export const Led = ({ on }: { on: boolean }) => <span className={on ? 'led led--on' : 'led'} />

export interface SegOption<T extends string> {
  value: T
  label: ReactNode
  sub?: ReactNode
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  fill,
  size,
  label,
}: {
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
  fill?: boolean
  size?: 'md' | 'sm'
  label: string
}) {
  return (
    <div className={fill ? 'seg seg--fill' : 'seg'} role="group" aria-label={label}>
      {options.map((o) => (
        <Key key={o.value} size={size} pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.sub ? (
            <span className="stack">
              <span>{o.label}</span>
              <span className="sub">{o.sub}</span>
            </span>
          ) : (
            o.label
          )}
        </Key>
      ))}
    </div>
  )
}

/** A latching key with an indicator LED. */
export function Toggle({
  on,
  onChange,
  children,
  chip,
}: {
  on: boolean
  onChange: (on: boolean) => void
  children: ReactNode
  chip?: string
}) {
  return (
    <Key className="toggle" pressed={on} onClick={() => onChange(!on)}>
      <Led on={on} />
      {children}
      {chip && <span className="chip" style={{ background: chip }} />}
    </Key>
  )
}

const format = (v: number, decimals: number) => v.toFixed(decimals)

/**
 * Numeric LCD entry with chunky steppers. Arrow keys step, Shift steps ×10;
 * typing commits on Enter or blur.
 */
export function LcdField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = -Infinity,
  max = Infinity,
  decimals = 0,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  step?: number
  min?: number
  max?: number
  decimals?: number
}) {
  // A draft only lives while it was typed against the current value.
  const [edit, setEdit] = useState<{ text: string; base: number } | null>(null)
  const draft = edit && edit.base === value ? edit.text : null
  const setDraft = (text: string | null) => setEdit(text === null ? null : { text, base: value })

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const commit = (raw: string) => {
    const v = Number(raw.replace(',', '.'))
    if (Number.isFinite(v)) onChange(clamp(Number(v.toFixed(decimals))))
    setDraft(null)
  }
  const nudge = (dir: 1 | -1, big = false) => onChange(clamp(Number((value + dir * step * (big ? 10 : 1)).toFixed(decimals))))

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-row">
        <span className="lcd">
          <input
            inputMode="decimal"
            value={draft ?? format(value, decimals)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                nudge(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey)
              }
            }}
          />
          {unit && <span className="unit">{unit}</span>}
        </span>
        <span className="steppers">
          <Key size="sm" aria-label={`Increase ${label}`} onClick={() => nudge(1)}>
            ▲
          </Key>
          <Key size="sm" aria-label={`Decrease ${label}`} onClick={() => nudge(-1)}>
            ▼
          </Key>
        </span>
      </span>
    </label>
  )
}

export function Panel({
  num,
  it,
  en,
  children,
}: {
  num: string
  it: string
  en: string
  children: ReactNode
}) {
  return (
    <section className="panel" aria-label={en}>
      <header className="panel-head">
        <span className="num">{num}</span>
        <span className="it">{it}</span>
        <span className="en">{en}</span>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}
