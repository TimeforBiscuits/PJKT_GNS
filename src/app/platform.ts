// Apple keyboards (Mac, and iPad with a keyboard) use ⌘ for shortcuts;
// Windows uses Ctrl. iPadOS describes itself as a Mac, which is what we want.

export const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

/** The shortcut modifier as it's printed on the keyboard. */
export const MOD = APPLE ? '⌘' : 'Ctrl+'

/** Is the platform's shortcut modifier held? (Ctrl on a Mac is not it.) */
export const isMod = (e: { metaKey: boolean; ctrlKey: boolean }) => (APPLE ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)
