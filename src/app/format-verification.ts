import { dateInRomania } from '../domain/journey-date.js'
import { ro } from '../i18n/ro.js'

export function formatVerification(value: string | null) {
  if (!value) return ro.verificationUnknown

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T12:00:00Z`)
    return ro.verifiedOn(new Intl.DateTimeFormat(ro.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Bucharest',
    }).format(dateOnly))
  }

  const date = new Date(value)
  const today = dateInRomania(new Date())
  const verifiedDate = dateInRomania(date)
  const time = new Intl.DateTimeFormat(ro.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  }).format(date)

  if (today === verifiedDate) return ro.verifiedToday(time)
  return ro.verifiedOn(new Intl.DateTimeFormat(ro.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(date), time)
}
