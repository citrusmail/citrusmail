// Floating local datetimes (`YYYY-MM-DDTHH:mm:ss`) against IANA zones, with
// Intl only: ical.js has no zone data of its own

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string): Intl.DateTimeFormat {
  let value = formatters.get(zone)
  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    formatters.set(zone, value)
  }

  return value
}

export function isValidZone(zone: string): boolean {
  try {
    formatter(zone)

    return true
  } catch {
    return false
  }
}

// Some producers prefix the IANA name, e.g. `/mozilla.org/20050126_1/Europe/Berlin`
export function resolveZone(tzid: string | undefined): string | undefined {
  if (!tzid) {
    return undefined
  }
  if (isValidZone(tzid)) {
    return tzid
  }

  const segments = tzid.split('/')
  for (const count of [3, 2]) {
    const candidate = segments.slice(-count).join('/')
    if (isValidZone(candidate)) {
      return candidate
    }
  }

  return undefined
}

/** Floating string read as if it were UTC, for wall-clock arithmetic */
export function floatingMs(local: string): number {
  return Date.parse(`${local.slice(0, 19)}Z`)
}

export function msToFloating(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19)
}

export function epochToLocal(epoch: number, zone: string): string {
  const parts: Record<string, string> = {}
  for (const part of formatter(zone).formatToParts(new Date(epoch))) {
    parts[part.type] = part.value
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

export function localToEpoch(local: string, zone: string): number {
  const wall = floatingMs(local)
  const offsetAt = (epoch: number) => floatingMs(epochToLocal(epoch, zone)) - epoch

  // Second pass settles times next to a DST transition
  const first = wall - offsetAt(wall)

  return wall - offsetAt(first)
}
