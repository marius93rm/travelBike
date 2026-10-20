import { ExternalLink } from 'lucide-react'
import type { TrainSearchSource } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'

interface ProviderSearchLinksProps {
  sources: TrainSearchSource[] | undefined
}

export function ProviderSearchLinks({ sources }: ProviderSearchLinksProps) {
  const links = new Map<string, { name: string; url: string }>()

  for (const source of sources ?? []) {
    if (source.outcome === 'success' || !source.sourceInfo) continue
    const url = source.searchUrl ?? source.sourceInfo.url
    links.set(url, { name: source.sourceInfo.name, url })
  }

  if (links.size === 0) return null

  return (
    <div className="provider-search-links">
      {[...links.values()].map((source) => (
        <a
          className="secondary-button"
          href={source.url}
          key={source.url}
          target="_blank"
          rel="noreferrer"
        >
          {ro.verifyAtOperator(source.name)}
          <ExternalLink size={15} aria-hidden="true" />
          {' '}
          <span className="sr-only">{ro.opensNewTab}</span>
        </a>
      ))}
    </div>
  )
}
