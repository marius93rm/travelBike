import type { TrainSearchCriteria } from '../../src/domain/train.js'
import { load } from 'cheerio'
import { stationsById } from '../../src/domain/stations.js'
import { parseCfrJourneyHtml } from './cfr-journey-parser.js'
import type {
  ProviderSearchResult,
  TrainDataProvider,
} from './train-data-provider.js'

const DEFAULT_ENDPOINT = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'
const DEFAULT_PUBLIC_SOURCE_URL = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'

// The current CFR planner uses these public search labels, which differ from
// the historical operational labels retained in the timetable catalog.
const CURRENT_CFR_STATION_NAMES: Readonly<Record<string, string>> = {
  brasov: 'Brașov',
  codlea: 'Codlea',
}

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
    let searchPageUrl: string
    try {
      searchPageUrl = this.buildSearchPageUrl(criteria)
    } catch (error) {
      return this.failure('unavailable', fetchedAt, error)
    }

    let searchPage: Response
    try {
      searchPage = await this.fetcher(searchPageUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'BikeTrain-Romania/0.1 (+local MVP; cached requests)',
        },
        signal: AbortSignal.timeout(12_000),
      })
    } catch (error) {
      return this.failure('unavailable', fetchedAt, error)
    }

    if (searchPage.status === 429) {
      return {
        ...this.failure('rate_limited', fetchedAt, 'CFR limitează temporar cererile.'),
        retryAfterSeconds: retryAfterSeconds(searchPage.headers.get('retry-after')),
      }
    }
    if (!searchPage.ok) {
      return this.failure('unavailable', fetchedAt, `CFR journey source returned ${searchPage.status}`)
    }

    let searchPageHtml: string
    try {
      searchPageHtml = await this.readHtml(searchPage)
    } catch (error) {
      return this.failure('invalid_payload', fetchedAt, error)
    }

    let form: URLSearchParams
    try {
      form = this.searchForm(searchPageHtml, criteria)
    } catch (error) {
      return this.failure('invalid_payload', fetchedAt, error)
    }

    let resultPage: Response
    try {
      resultPage = await this.fetcher(this.resultUrl(), {
        method: 'POST',
        headers: {
          Accept: 'text/html, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'BikeTrain-Romania/0.1 (+local MVP; cached requests)',
          ...(this.sessionCookie(searchPage) ? { Cookie: this.sessionCookie(searchPage)! } : {}),
        },
        body: form.toString(),
        signal: AbortSignal.timeout(12_000),
      })
    } catch (error) {
      return this.failure('unavailable', fetchedAt, error)
    }

    if (resultPage.status === 429) {
      return {
        ...this.failure('rate_limited', fetchedAt, 'CFR limitează temporar cererile.'),
        retryAfterSeconds: retryAfterSeconds(resultPage.headers.get('retry-after')),
      }
    }
    if (!resultPage.ok) {
      return this.failure('unavailable', fetchedAt, `CFR journey source returned ${resultPage.status}`)
    }

    let html: string
    try {
      html = await this.readHtml(resultPage)
    } catch (error) {
      return this.failure('invalid_payload', fetchedAt, error)
    }
    if (/recaptchafailed|captcha|access denied|too many requests/i.test(html)) {
      return this.failure('unavailable', fetchedAt, 'CFR journey source requires interactive access.')
    }
    if (/servicetemporarilyunavailable/i.test(html)) {
      return this.failure('unavailable', fetchedAt, 'CFR journey source is temporarily unavailable.')
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

  private buildSearchPageUrl(criteria: TrainSearchCriteria): string {
    const url = new URL(this.endpoint)
    url.pathname = `/ro-RO/Rute-trenuri/${this.stationName(criteria.from)}/${this.stationName(criteria.to)}`
    url.search = ''
    url.searchParams.set('DepartureDate', `${this.officialDate(criteria.date)} 00:00:00`)
    url.searchParams.set('IsBikesServiceRequired', 'true')
    url.searchParams.set('ConnectionsTypeId', '1')
    url.searchParams.set('BetweenTrainsMinimumMinutes', '15')
    return url.toString()
  }

  private resultUrl() {
    const url = new URL(this.endpoint)
    url.pathname = '/ro-RO/Itineraries/GetItineraries'
    url.search = ''
    return url.toString()
  }

  private searchForm(html: string, criteria: TrainSearchCriteria) {
    const $ = load(html)
    const form = $('#form-search')
    const requestToken = form.find('input[name="__RequestVerificationToken"]').attr('value')
    const confirmationKey = form.find('input[name="ConfirmationKey"]').attr('value')
    if (!form.length || !requestToken || !confirmationKey) {
      throw new Error('CFR search form is not recognized')
    }

    const fields = new URLSearchParams()
    form.find('input[name]').each((_index, element) => {
      const input = $(element)
      const name = input.attr('name')
      if (name) fields.set(name, input.attr('value') ?? '')
    })

    fields.set('DepartureStationName', this.stationName(criteria.from))
    fields.set('ArrivalStationName', this.stationName(criteria.to))
    fields.set('DepartureDate', `${this.officialDate(criteria.date)} 00:00:00`)
    fields.set('ConnectionsTypeId', '1')
    fields.set('MinutesInDay', '0')
    fields.set('OrderingTypeId', '0')
    fields.set('TimeSelectionId', '0')
    fields.set('IsBikesServiceRequired', 'true')
    fields.set('IsOnlineBuyingRequired', 'False')
    fields.set('IsBarRestaurantServiceRequired', 'False')
    fields.set('IsSleeperCouchetteServiceRequired', 'False')
    fields.set('BetweenTrainsMinimumMinutes', '15')
    fields.set('IsSearchWanted', 'False')
    fields.set('IsReCaptchaFailed', 'False')
    fields.set('__RequestVerificationToken', requestToken)
    fields.set('ConfirmationKey', confirmationKey)
    return fields
  }

  private officialDate(isoDate: string) {
    return isoDate.split('-').reverse().join('.')
  }

  private async readHtml(response: Response) {
    const contentType = response.headers.get('content-type') ?? ''
    if (!/^text\/html(?:;|$)/i.test(contentType)) {
      throw new Error('CFR returned a non-HTML response.')
    }
    const contentLength = Number(response.headers.get('content-length'))
    const maxBodyBytes = this.options.maxBodyBytes ?? 750_000
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      throw new Error('CFR response exceeds the configured size limit.')
    }
    const html = await response.text()
    if (new TextEncoder().encode(html).byteLength > maxBodyBytes) {
      throw new Error('CFR response exceeds the configured size limit.')
    }
    return html
  }

  private sessionCookie(response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const rawCookies = headers.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : [])
    const cookies = rawCookies.map((cookie) => cookie.split(';', 1)[0]).filter(Boolean)
    return cookies.length ? cookies.join('; ') : undefined
  }

  private stationName(id: string): string {
    const currentPlannerName = CURRENT_CFR_STATION_NAMES[id]
    if (currentPlannerName) return currentPlannerName
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
