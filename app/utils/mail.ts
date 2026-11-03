import { format, isThisYear, isToday, isYesterday } from 'date-fns'

export const FOLDER_ICONS: Record<FolderRole, string> = {
  inbox: 'i-lucide-inbox',
  drafts: 'i-lucide-file-pen-line',
  sent: 'i-lucide-send',
  junk: 'i-lucide-shield-alert',
  trash: 'i-lucide-trash-2',
  archive: 'i-lucide-archive',
  flagged: 'i-lucide-flag'
}

export function folderIcon(folder?: Folder): string {
  return folder?.role ? FOLDER_ICONS[folder.role] : 'i-lucide-folder'
}

export function folderLink(path: string): string {
  return `/mail/${encodeURIComponent(path)}`
}

export function personName(address?: Address): string {
  if (!address) return 'Unknown sender'
  return address.name?.trim() || address.address
}

export function formatAddress(address: Address): string {
  return address.name ? `${address.name} <${address.address}>` : address.address
}

// The list shows the time for today, a weekday-ish word for yesterday and a
// date otherwise, the year only once it is not this one
export function listDate(value: string): string {
  const date = new Date(value)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Yesterday'
  return isThisYear(date) ? format(date, 'd MMM') : format(date, 'd MMM yyyy')
}

export function fullDate(value: string): string {
  return format(new Date(value), 'EEE d MMM yyyy, HH:mm')
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function attachmentIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return 'i-lucide-image'
  if (contentType === 'application/pdf') return 'i-lucide-file-text'
  if (contentType.includes('zip') || contentType.includes('compressed')) return 'i-lucide-file-archive'
  if (contentType.startsWith('audio/')) return 'i-lucide-file-audio'
  if (contentType.startsWith('video/')) return 'i-lucide-file-video'
  if (contentType.includes('sheet') || contentType.includes('csv') || contentType.includes('excel')) return 'i-lucide-file-spreadsheet'
  return 'i-lucide-file'
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}

// "Ada <ada@x.com>, bob@y.com" → addresses, for pasted recipient lists
export function parseAddresses(value: string): Address[] {
  return value.split(/[,;\n]/).map((part) => {
    const match = part.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
    if (match) return { name: match[1]!.trim() || undefined, address: match[2]!.trim() }
    return { address: part.trim() }
  }).filter(address => isEmail(address.address))
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
