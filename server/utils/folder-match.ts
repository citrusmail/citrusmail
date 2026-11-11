/**
 * Finding a folder by name, for settings saved on another device. Rules and
 * notification folders are kept by path, and a path means something else on
 * each protocol: over IMAP it's the folder's full name ("INBOX.Work.AWS"),
 * over JMAP the mailbox id. When the path isn't one of this account's
 * folders, the folder's full name (kept beside the path when it was saved)
 * finds it instead, so settings carry over between IMAP and JMAP
 */

/** A full name, compared without case, delimiter or IMAP's INBOX. prefix */
export function folderKey(fullName: string): string {
  const parts = fullName.split(/[./]/).filter(Boolean)
  if (parts.length > 1 && parts[0]!.toLowerCase() === 'inbox') parts.shift()
  return parts.join('/').toLowerCase()
}

/** A folder's full name: what JMAP reports, or the IMAP path itself */
export function folderFullName(folder: Folder): string {
  return folder.fullName ?? folder.path
}

/** The folder a saved path (and the full name saved with it) means on this account */
export function matchFolder(folders: Folder[], path: string, fullName?: string): Folder | undefined {
  const exact = folders.find(folder => folder.path === path)
  if (exact) return exact
  const key = folderKey(fullName ?? path)
  return key ? folders.find(folder => folderKey(folderFullName(folder)) === key) : undefined
}
