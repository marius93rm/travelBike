import { Clock3 } from 'lucide-react'
import { ro } from '../../i18n/ro.js'

interface SearchFreshnessProps {
  asOf: string | null | undefined
}

export function SearchFreshness({ asOf }: SearchFreshnessProps) {
  if (!asOf) return null

  const checkedAt = new Date(asOf)
  if (!Number.isFinite(checkedAt.getTime())) return null

  const formatted = new Intl.DateTimeFormat(ro.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(checkedAt)

  return (
    <p className="result-freshness">
      <Clock3 size={14} aria-hidden="true" />
      <span>{ro.lastCheckedAt}</span>
      <time dateTime={asOf}>{formatted}</time>
    </p>
  )
}
