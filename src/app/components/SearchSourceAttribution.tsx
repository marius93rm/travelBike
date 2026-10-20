import { ExternalLink } from 'lucide-react'
import type { TrainSearchSource } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'

interface SearchSourceAttributionProps {
  sources: TrainSearchSource[] | undefined
}

export function SearchSourceAttribution({ sources }: SearchSourceAttributionProps) {
  const sourceByUrl = new Map<string, { name: string; url: string }>()
  for (const source of sources ?? []) {
    if (source.outcome === 'success' && source.sourceInfo) {
      sourceByUrl.set(source.sourceInfo.url, source.sourceInfo)
    }
  }

  if (sourceByUrl.size === 0) return null

  return (
    <p className="result-source-attribution">
      <span>{ro.resultSourceLabel}</span>
      {[...sourceByUrl.values()].map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
          {source.name}
          <ExternalLink size={12} aria-hidden="true" />
          <span className="sr-only">{ro.opensNewTab}</span>
        </a>
      ))}
    </p>
  )
}
