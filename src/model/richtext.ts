import type { TextSpan } from './doc'

// Bold and italic stretches inside a text layer. The text itself stays a
// plain string; spans mark character ranges [start, end).

export interface Run {
  start: number
  end: number
  bold: boolean
  italic: boolean
}

/** Per-character style flags. */
function flags(length: number, spans: TextSpan[] | undefined) {
  const b = new Uint8Array(length)
  const i = new Uint8Array(length)
  for (const s of spans ?? []) {
    for (let k = Math.max(0, s.start); k < Math.min(length, s.end); k++) {
      if (s.bold) b[k] = 1
      if (s.italic) i[k] = 1
    }
  }
  return { b, i }
}

/** The text cut into stretches of one style, covering [from, to). */
export function runsOf(length: number, spans: TextSpan[] | undefined, from = 0, to = length): Run[] {
  const { b, i } = flags(length, spans)
  const runs: Run[] = []
  for (let k = from; k < to; k++) {
    const last = runs[runs.length - 1]
    const bold = !!b[k]
    const italic = !!i[k]
    if (last && last.bold === bold && last.italic === italic) last.end = k + 1
    else runs.push({ start: k, end: k + 1, bold, italic })
  }
  return runs
}

/** Tidy spans from per-character flags: merged, sorted, styled stretches only. */
export function spansFromFlags(bold: ArrayLike<number | boolean>, italic: ArrayLike<number | boolean>): TextSpan[] {
  const out: TextSpan[] = []
  for (let k = 0; k < bold.length; k++) {
    const b = !!bold[k]
    const it = !!italic[k]
    if (!b && !it) continue
    const last = out[out.length - 1]
    if (last && last.end === k && !!last.bold === b && !!last.italic === it) last.end = k + 1
    else out.push({ start: k, end: k + 1, ...(b && { bold: true }), ...(it && { italic: true }) })
  }
  return out
}

export const normalizeSpans = (length: number, spans: TextSpan[] | undefined): TextSpan[] => {
  const { b, i } = flags(length, spans)
  return spansFromFlags(b, i)
}

/** Which style combinations the text actually uses. */
export const stylesUsed = (length: number, spans: TextSpan[] | undefined) => {
  const seen = new Set<string>()
  const out: { bold: boolean; italic: boolean }[] = []
  for (const r of runsOf(length, spans)) {
    const k = `${r.bold}${r.italic}`
    if (!seen.has(k)) {
      seen.add(k)
      out.push({ bold: r.bold, italic: r.italic })
    }
  }
  if (!out.length) out.push({ bold: false, italic: false })
  return out
}
