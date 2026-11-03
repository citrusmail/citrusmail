import type { ReceiptSettings } from '../types/index'

/** Tracking is usable once the image has somewhere to be loaded from: Faivelo, or this server's own public address */
export function trackingReady(receipts?: Partial<ReceiptSettings>): boolean {
  return !!receipts?.images && (receipts.provider === 'faivelo' || !!receipts.origin)
}

/** A mailbox hosted by Faivelo, whose own servers can track opens for it */
export function isFaiveloHost(host?: string): boolean {
  return !!host && /(^|\.)faivelo\.com$/i.test(host.trim())
}
