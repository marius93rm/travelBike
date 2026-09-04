const BUCHAREST_TIME_ZONE = 'Europe/Bucharest'

function offsetForRomania(date: string, time: string): string {
  const sample = new Date(`${date}T${time}:00Z`)
  const part = new Intl.DateTimeFormat('en', {
    timeZone: BUCHAREST_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(sample)
    .find(({ type }) => type === 'timeZoneName')?.value
  const match = part?.match(/GMT([+-]\d{2}:\d{2})/)
  return match?.[1] ?? '+02:00'
}

export function scheduledAt(date: string, time: string, dayOffset = 0): string {
  const serviceDate = new Date(`${date}T12:00:00Z`)
  serviceDate.setUTCDate(serviceDate.getUTCDate() + dayOffset)
  const localDate = serviceDate.toISOString().slice(0, 10)
  return `${localDate}T${time}:00${offsetForRomania(localDate, time)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
