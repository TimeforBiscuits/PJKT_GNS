/** Snap to the pixel grid so 1px lines render crisp. */
export const crisp = (v: number) => Math.round(v) + 0.5

/** Millimetres as the drafting labels show them. */
export const mm = (v: number) => v.toFixed(1)
