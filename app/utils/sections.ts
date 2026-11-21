export type Section = 'mail' | 'calendar' | 'contacts' | 'settings'

/** The sections a two-finger swipe walks through, left to right */
export const SWIPE_SECTIONS: Section[] = ['mail', 'calendar', 'contacts']

export function sectionOf(path: string): Section {
  if (path.startsWith('/calendar')) return 'calendar'
  if (path.startsWith('/contacts')) return 'contacts'
  if (path.startsWith('/settings')) return 'settings'
  return 'mail'
}
