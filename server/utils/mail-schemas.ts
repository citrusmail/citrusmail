import { z } from 'zod'

/** `?folder=` on every message route: the IMAP path (POP3: INBOX) */
export const folderQuery = z.object({
  folder: z.string().min(1).max(1000)
})

/** IMAP UIDs are numbers, POP3 UIDLs are printable ASCII (RFC 1939: 1-70 chars) */
export const messageIdParam = z.string().regex(/^[\x21-\x7E]{1,70}$/, 'Invalid message id')

/** A folder name typed by a person: no hierarchy separators or IMAP wildcards */
export const folderName = z.string().trim().min(1, 'Give the folder a name').max(100)
  .refine(name => !/[/\\*%]/.test(name), 'Folder names can\'t contain / \\ * or %')
