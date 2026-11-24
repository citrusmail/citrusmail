/** A count in the Contacts sidebar, worn the way Mail wears unread: a soft neutral badge */
export const countBadge = (count: number) => count
  ? { label: String(count), color: 'neutral' as const, variant: 'subtle' as const, size: 'sm' as const, class: 'font-semibold tabular-nums' }
  : undefined
