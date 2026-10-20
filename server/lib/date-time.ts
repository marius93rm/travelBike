const BUCHAREST_TIME_ZONE = 'Europe/Bucharest'
const OFFSET_FORMATTER = new Intl.DateTimeFormat('en', {
  timeZone: BUCHAREST_TIME_ZONE,
  timeZoneName: 'longOffset',
})
const LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUCHAREST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function offsetAt(instant: Date): { minutes: number; text: string } {
  const part = OFFSET_FORMATTER
    .formatToParts(instant)
    .find(({ type }) => type === 'timeZoneName')?.value
  if (part === 'GMT') return { minutes: 0, text: '+00:00' }

  const match = part?.match(/^GMT([+-])(\d{2}):(\d{2})$/)
  if (!match) throw new Error(`Cannot determine ${BUCHAREST_TIME_ZONE} offset`)

  const [, sign, hours, minutes] = match
  const absoluteMinutes = Number(hours) * 60 + Number(minutes)
  return {
    minutes: sign === '+' ? absoluteMinutes : -absoluteMinutes,
    text: `${sign}${hours}:${minutes}`,
  }
}

function matchesLocalDateTime(instant: Date, date: string, time: string): boolean {
  const parts = Object.fromEntries(
    LOCAL_DATE_TIME_FORMATTER.formatToParts(instant).map(({ type, value }) => [type, value]),
  )
  return parts.year === date.slice(0, 4)
    && parts.month === date.slice(5, 7)
    && parts.day === date.slice(8, 10)
    && parts.hour === time.slice(0, 2)
    && parts.minute === time.slice(3, 5)
}

export function scheduledAt(date: string, time: string, dayOffset = 0): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid Romanian service date: ${date}`)
  }
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid Romanian service date: ${date}`)
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Invalid Romanian local time: ${time}`)
  }
  if (!Number.isInteger(dayOffset)) {
    throw new Error(`Invalid Romanian service day offset: ${dayOffset}`)
  }

  const serviceDate = new Date(`${date}T12:00:00Z`)
  serviceDate.setUTCDate(serviceDate.getUTCDate() + dayOffset)
  const localDate = serviceDate.toISOString().slice(0, 10)
  const wallTimeAsUtc = new Date(`${localDate}T${time}:00Z`)
  const utcMidnight = new Date(`${localDate}T00:00:00Z`).getTime()
  const possibleOffsets = new Map<number, string>()

  // Sampling both sides of local midnight captures either offset when the
  // service date contains a clock change. Round-trip checks below discard
  // offsets that do not represent this exact local date and time.
  for (const hoursFromMidnight of [-24, 0, 24]) {
    const offset = offsetAt(new Date(utcMidnight + hoursFromMidnight * 60 * 60 * 1000))
    possibleOffsets.set(offset.minutes, offset.text)
  }

  const matchingOffsets = [...possibleOffsets.entries()]
    .filter(([offsetMinutes]) => {
      const instant = new Date(wallTimeAsUtc.getTime() - offsetMinutes * 60 * 1000)
      return matchesLocalDateTime(instant, localDate, time)
    })
    .map(([, offset]) => offset)

  if (matchingOffsets.length === 0) {
    throw new Error(`Romanian local time ${localDate} ${time} does not exist in ${BUCHAREST_TIME_ZONE}`)
  }
  if (matchingOffsets.length > 1) {
    throw new Error(`Romanian local time ${localDate} ${time} is ambiguous in ${BUCHAREST_TIME_ZONE}`)
  }

  return `${localDate}T${time}:00${matchingOffsets[0]}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function latestIsoTimestamp(current: string | null, candidate: string | null): string | null {
  if (candidate === null) return current
  if (current === null || Date.parse(candidate) > Date.parse(current)) return candidate
  return current
}
