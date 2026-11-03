import type { AccountSettings, SessionAccount } from './index'

declare module '#auth-utils' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the session user is exactly SessionAccount
  interface User extends SessionAccount {}

  interface SecureSessionData {
    /** The mailbox on screen */
    account: AccountSettings
    /** The other mailboxes signed in on this browser */
    others?: AccountSettings[]
  }
}

export {}
