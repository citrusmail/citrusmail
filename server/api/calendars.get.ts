import { defineEventHandler } from 'nuxt/server'

const COLORS: Calendar['color'][] = ['info', 'success', 'warning', 'secondary', 'error', 'primary']

function hue(color: unknown): number | undefined {
  const hex = typeof color === 'string' ? color.match(/^#?([0-9a-f]{6})/i)?.[1] : undefined
  if (!hex) {
    return undefined
  }

  const [r, g, b] = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  // Greys and near-blacks have no hue worth matching
  if (max - min < 0.15) {
    return undefined
  }

  const delta = max - min
  const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4

  return (raw * 60 + 360) % 360
}

function colorFor(color: unknown, index: number): Calendar['color'] {
  const value = hue(color)
  if (value === undefined) {
    return COLORS[index % COLORS.length]!
  }
  if (value < 20 || value >= 335) {
    return 'error'
  }
  if (value < 70) {
    return 'warning'
  }
  if (value < 170) {
    return 'success'
  }
  if (value < 255) {
    return 'info'
  }

  return 'secondary'
}

export default defineEventHandler(async (event): Promise<Calendar[]> => {
  const dav = await useCalDav(await requireAccount(event))

  return (dav?.collections ?? []).map((calendar, index) => ({
    id: encodeId(calendar.url),
    name: displayName(calendar),
    color: colorFor(calendar.calendarColor, index)
  }))
})
