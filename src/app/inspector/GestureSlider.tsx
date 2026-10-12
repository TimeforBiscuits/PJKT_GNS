import { useDoc } from '../../store/doc'

/** Range slider whose drag counts as one undo step. */
export function GestureSlider({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const begin = useDoc((s) => s.beginGesture)
  const end = useDoc((s) => s.endGesture)
  return (
    <input
      className="slider"
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
          end()
        }
        window.addEventListener('pointerup', finish, { signal: done.signal })
        window.addEventListener('pointercancel', finish, { signal: done.signal })
      }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
