import { z } from 'zod'

/** `?folder=` on every message route: the IMAP path (POP3: INBOX) */
export const folderQuery = z.object({
  folder: z.string().min(1).max(1000)
})

/**
 * IMAP UIDs are numbers, POP3 UIDLs are printable ASCII (RFC 1939: 1-70
 * chars), JMAP ids are URL-safe base64 up to 255. mailFor() checks each
 * against its own protocol
 */
export const messageIdParam = z.string().regex(/^[\x21-\x7E]{1,255}$/, 'Invalid message id')

/** A saved draft's id: an IMAP UID or a JMAP id */
export const draftId = z.string().regex(/^[A-Za-z0-9_-]{1,255}$/, 'Invalid draft id')

/** A folder name typed by a person: no hierarchy separators or IMAP wildcards */
export const folderName = z.string().trim().min(1, 'Give the folder a name').max(100)
  .refine(name => !/[/\\*%]/.test(name), 'Folder names can\'t contain / \\ * or %')
