import { useDoc } from '../../store/doc'

/** Range slider whose drag counts as one undo step. `centred` marks the middle of its track as zero. */
export function GestureSlider({ value, min, max, step, onChange, label, centred = false }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; centred?: boolean }) {
  const begin = useDoc((s) => s.beginGesture)
  const end = useDoc((s) => s.endGesture)
  return (
    <input
      className={centred ? 'slider slider--centred' : 'slider'}
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={Math.min(max, Math.max(min, value))}
      onPointerDown={() => {
        begin()
        // Whichever comes first: the finger lifts, or the browser takes the touch over.
        const done = new AbortController()
        const finish = () => {
          done.abort()
          // The slider's last change event comes after the release: let it land in this step too.
          setTimeout(end, 0)
        }
        window.addEventListener('pointerup', finish, { signal: done.signal })
        window.addEventListener('pointercancel', finish, { signal: done.signal })
      }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
