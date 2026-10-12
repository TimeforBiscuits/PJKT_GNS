import type { Layer } from '../model/doc'

/**
 * What an effect render depends on: the layer's own content, not where it
 * sits. Moving or turning a layer never redraws its effects.
 */
export function fxKey(l: Layer): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { x, y, rotation, id, name, hidden, locked, opacity, ...content } = l
  return JSON.stringify(content)
}
