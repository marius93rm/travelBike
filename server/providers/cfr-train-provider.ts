import type { TrainSearchCriteria } from '../../src/domain/train.js'
import { stationsById } from '../../src/domain/stations.js'
import { parseCfrJourneyHtml } from './cfr-journey-parser.js'
import type {
  ProviderSearchResult,
  TrainDataProvider,
} from './train-data-provider.js'

const DEFAULT_ENDPOINT = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'
const DEFAULT_PUBLIC_SOURCE_URL = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'

export interface CfrTrainProviderOptions {
  /** Explicit allowlist for the upstream host; defaults to the official CFR host. */
  allowedHosts?: readonly string[]
  /** Public provenance URL. Query parameters used to acquire data stay private. */
  publicSourceUrl?: string
  maxBodyBytes?: number
}

export class CfrTrainProvider implements TrainDataProvider {
  readonly id = 'cfr'
  readonly capabilities = { journeySearch: true, directDestinationDiscovery: false }
  private readonly safePublicSourceUrl: string

  constructor(
    private readonly endpoint = DEFAULT_ENDPOINT,
    private readonly fetcher: typeof fetch = fetch,
    private readonly options: CfrTrainProviderOptions = {},
  ) {
    this.validateAcquisitionUrl()
    this.safePublicSourceUrl = this.sanitizedPublicSourceUrl()
  }

  isReady() { return true }

  async search(criteria: TrainSearchCriteria): Promise<ProviderSearchResult> {
    const fetchedAt = new Date().toISOString()
    let sourceUrl: string
    try {
      sourceUrl = this.buildUrl(criteria)
    } catch (error) {
      return this.failure('unavailable', fetchedAt, error)
    }

    let response: Response
    try {
      response = await this.fetcher(sourceUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'BikeTrain-Romania/0.1 (+local MVP; cached requests)',
        },
        signal: AbortSignal.timeout(12_000),
      })
    } catch (error) {
      return this.failure('unavailable', fetchedAt, error)
    }

    if (response.status === 429) {
      return {
        ...this.failure('rate_limited', fetchedAt, 'CFR limitează temporar cererile.'),
        retryAfterSeconds: retryAfterSeconds(response.headers.get('retry-after')),
      }
    }
    if (!response.ok) {
      return this.failure('unavailable', fetchedAt, `CFR journey source returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!/^text\/html(?:;|$)/i.test(contentType)) {
      return this.failure('invalid_payload', fetchedAt, 'CFR returned a non-HTML response.')
    }
    const contentLength = Number(response.headers.get('content-length'))
    const maxBodyBytes = this.options.maxBodyBytes ?? 750_000
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      return this.failure('invalid_payload', fetchedAt, 'CFR response exceeds the configured size limit.')
    }

    let html: string
    try {
      html = await response.text()
    } catch (error) {
      return this.failure('unavailable', fetchedAt, error)
    }
    if (new TextEncoder().encode(html).byteLength > maxBodyBytes) {
      return this.failure('invalid_payload', fetchedAt, 'CFR response exceeds the configured size limit.')
    }
    if (/captcha|access denied|too many requests/i.test(html)) {
      return this.failure('unavailable', fetchedAt, 'CFR journey source requires interactive access.')
    }

    try {
      return {
        options: parseCfrJourneyHtml(html, criteria, this.publicSourceUrl(), fetchedAt),
        providerId: this.id,
        fetchedAt,
        outcome: 'success',
      }
    } catch (error) {
      return this.failure('invalid_payload', fetchedAt, error)
    }
  }

  private buildUrl(criteria: TrainSearchCriteria): string {
    const url = new URL(this.endpoint)
    const date = criteria.date.split('-').reverse().join('.')
    url.searchParams.set('DepartureStationName', this.stationName(criteria.from))
    url.searchParams.set('ArrivalStationName', this.stationName(criteria.to))
    url.searchParams.set('DepartureDate', `${date} 00:00:00`)
    url.searchParams.set('IsBikesServiceRequired', 'true')
    url.searchParams.set('ConnectionsTypeId', '1')
    url.searchParams.set('BetweenTrainsMinimumMinutes', '15')
    return url.toString()
  }

  private stationName(id: string): string {
    const station = stationsById.get(id)
    return station?.providerNames?.cfr ?? station?.providerName ?? station?.name ?? id
  }

  private allowedHosts() {
    return this.options.allowedHosts ?? ['bilete.cfrcalatori.ro']
  }

  private publicSourceUrl() {
    return this.safePublicSourceUrl
  }

  private validateAcquisitionUrl() {
    const url = new URL(this.endpoint)
    if (url.protocol !== 'https:' || !this.allowedHosts().includes(url.hostname)) {
      throw new Error('CFR endpoint must use an explicitly allowed HTTPS host')
    }
  }

  private sanitizedPublicSourceUrl() {
    const isExplicit = this.options.publicSourceUrl !== undefined
    const url = new URL(this.options.publicSourceUrl ?? DEFAULT_PUBLIC_SOURCE_URL)
    const allowedPublicHosts = isExplicit
      ? this.allowedHosts()
      : ['bilete.cfrcalatori.ro']
    if (url.protocol !== 'https:' || !allowedPublicHosts.includes(url.hostname)) {
      throw new Error('Public CFR source URL must use an explicitly allowed HTTPS host')
    }
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString()
  }

  private failure(
    outcome: 'unsupported' | 'unavailable' | 'rate_limited' | 'invalid_payload',
    fetchedAt: string,
    error: unknown,
  ): ProviderSearchResult {
    return {
      options: [], providerId: this.id, fetchedAt, outcome,
      warning: error instanceof Error ? error.message : String(error),
    }
  }
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000))
}
