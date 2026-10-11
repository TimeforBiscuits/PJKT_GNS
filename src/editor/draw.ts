/** Snap to the pixel grid so 1px lines render crisp. */
export const crisp = (v: number) => Math.round(v) + 0.5

/** Millimetres as the drafting labels show them. */
export const mm = (v: number) => v.toFixed(1)

/** Mirror transform for a flipped picture, about its own centre. */
export const flipMatrix = (l: {
  flipX: boolean
  flipY: boolean
  content: { x: number; y: number; w: number; h: number }
}): string | undefined => {
  if (!l.flipX && !l.flipY) return undefined
  const c = l.content
  return `matrix(${l.flipX ? -1 : 1} 0 0 ${l.flipY ? -1 : 1} ${l.flipX ? 2 * c.x + c.w : 0} ${l.flipY ? 2 * c.y + c.h : 0})`
}

/** Readout colour for an effective resolution. */
export const ppiColor = (ppi: number) => (ppi >= 300 ? 'var(--lcd)' : ppi >= 200 ? '#ffb000' : '#ff4f4f')
