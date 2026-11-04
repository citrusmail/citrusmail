/** Where a clicked new-mail banner takes you */
interface DesktopOpen {
  mailbox: string
  folder: string
  /** Absent when the banner summed up several messages: the folder opens */
  id?: string
}

/** What the Mac app's preload exposes to the page (desktop/preload.cjs) */
interface CitrusDesktop {
  platform: string
  notify: (notice: { title: string, body?: string, open?: DesktopOpen }) => Promise<boolean>
  onOpen: (handler: (open: DesktopOpen) => void) => () => void
}

interface Window {
  citrusDesktop?: CitrusDesktop
}
