/**
 * Moves a value saved in this browser under an old key to its new key, once.
 * Keeps drafts and appearance choices made before the app was renamed
 */
export function renameStoredKey(from: string, to: string) {
  try {
    const old = localStorage.getItem(from)
    if (old !== null && localStorage.getItem(to) === null) localStorage.setItem(to, old)
    localStorage.removeItem(from)
  } catch {
    // Storage can be off (private windows, blocked site data): nothing to move
  }
}
