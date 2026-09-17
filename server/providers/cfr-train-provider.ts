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

// The current CFR planner uses public commercial labels, which differ from
// the operational labels retained in the timetable catalog. This map is
// versioned with the pilot because the planner is a public HTML surface, not
// a versioned API. Verified against the planner station list on 2026-09-16.
const CURRENT_CFR_STATION_NAMES: Readonly<Record<string, string>> = {
  // Brașov
  brasov: 'Brașov',
  codlea: 'Codlea',
  'cfr-20012': 'Bartolomeu',
  'cfr-20036': 'Ghimbav',
  'cfr-20074': 'Dumbrăvița Bârsei Hm',
  'cfr-20086': 'Vlădeni Ardeal',
  'cfr-20103': 'Valea Homorod h',
  'cfr-20127': 'Brădet Hm',
  'cfr-20141': 'Perșani',
  'cfr-20165': 'Șercaia',
  'cfr-20206': 'Mândra Oltului Hm',
  'cfr-20232': 'Făgăraș',
  'cfr-20244': 'Beclean pe Olt h',
  'cfr-20268': 'Dridif hc',
  'cfr-20270': 'Voila',
  'cfr-20309': 'Viștea hc',
  'cfr-20311': 'Ucea',
  'cfr-30615': 'Predeal',
  'cfr-30641': 'Timișu de Sus Hm',
  'cfr-30653': 'Timișu de Jos hc',
  'cfr-30665': 'Dârste',
  'cfr-30756': 'Pavilion CFR Brașov Triaj',
  'cfr-30835': 'Stupini Hm',
  'cfr-30859': 'Bod',
  'cfr-30885': 'Feldioara',
  'cfr-30897': 'Rotbav hc',
  'cfr-30902': 'Vadu Roșu h',
  'cfr-30914': 'Măierus hc',
  'cfr-30938': 'Apața',
  'cfr-30952': 'Ormeniș hc',
  'cfr-31011': 'Racoș',
  'cfr-31023': 'Mateiaș hc',
  'cfr-31047': 'Rupea',
  'cfr-31073': 'Cața Hm',
  'cfr-31097': 'Paloș Ardeal hc',
  'cfr-31102': 'Beia',
  'cfr-40024': 'Hărman',
  'cfr-40050': 'Prejmer',
  'cfr-57223': 'Pavilion CFR Brașov Triaj',

  // Sibiu
  'cfr-20359': 'Arpaș',
  'cfr-20361': 'Cârța hc',
  'cfr-20373': 'Scoreiu hc',
  'cfr-20385': 'Sărata Colun hc',
  'cfr-20397': 'Porumbacu',
  'cfr-20414': 'Avrig',
  'cfr-20440': 'Mârșa hc',
  'cfr-20464': 'Racovița',
  'cfr-20476': 'Sebeș Olt hc',
  'cfr-20490': 'Podu Olt',
  'cfr-20517': 'Tălmaciu',
  'cfr-20531': 'Veștem hc',
  'cfr-20543': 'Mohu Hm',
  'cfr-20567': 'Sibiu Gr. Șelimbăr Hm',
  'cfr-20622': 'Sibiu Triaj h',
  'cfr-20634': 'Atelier Zona h',
  'cfr-20658': 'Sibiu',
  'cfr-20713': 'Sibiu hc',
  'cfr-20749': 'Turnișor',
  'cfr-20775': 'Cristian Sibiu',
  'cfr-20787': 'Orlat',
  'cfr-20799': 'Sibiel hc',
  'cfr-20804': 'Săcelu Sibiului hc',
  'cfr-20816': 'Săliște',
  'cfr-20830': 'Aciliu hc',
  'cfr-20842': 'Tilișca Hm',
  'cfr-20866': 'Apoldu de Sus',
  'cfr-20880': 'Apoldu de Jos hc',
  'cfr-20892': 'Miercurea Sibiu',
  'cfr-20919': 'Băile Miercurea hc',
  'cfr-22694': 'Turnu Roșu',
  'cfr-22670': 'Valea Mărului Hm',
  'cfr-25402': 'Valea Viilor Hm',
  'cfr-31279': 'Dumbrăveni',
  'cfr-31293': 'Ațel',
  'cfr-31308': 'Brătei h',
  'cfr-31334': 'Mediaș',
  'cfr-31372': 'Târnava h',
  'cfr-31401': 'Copșa Mica',
  'cfr-31437': 'Micăsasa h',
  'cfr-31255': 'Luna h',
  'cfr-33758': 'Mândra h',
  'cfr-33710': 'Ocna Sibiului',
  'cfr-33746': 'Băile Ocna Sibiului hc',
  'cfr-33760': 'Loamneș Hm',
  'cfr-33772': 'Hășag hc',
  'cfr-33784': 'Veșeud h',
  'cfr-33796': 'Șeica Mare hc',
  'cfr-33801': 'Șeica Mare',
  'cfr-33825': 'Agârbiciu hc',
  'cfr-33837': 'Axente Sever h',
  'cfr-57118': 'Șeica Mică',

  // Covasna
  'cfr-40036': 'Ilieni hc',
  'cfr-40074': 'Chichiș hc',
  'cfr-40103': 'Ozun',
  'cfr-40139': 'Sfântu Gheorghe',
  'cfr-40165': 'Arcuș h',
  'cfr-40177': 'Bodoc',
  'cfr-40191': 'Malnaș hc',
  'cfr-40206': 'Malnaș Băi',
  'cfr-40220': 'Bicsadu Oltului',

  // Mureș
  'cfr-31126': 'Archita Hm',
  'cfr-31140': 'Mureni',
  'cfr-31164': 'Vânători',
  'cfr-31190': 'Albești Târnava',
  'cfr-31217': 'Sighișoara',
  'cfr-31243': 'Daneș',
  'cfr-57132': 'Saschiz h',
  'cfr-40696': 'Ciobotani h',
  'cfr-40701': 'Stânceni',
  'cfr-40713': 'Stânceni hc',
  'cfr-40725': 'Stânceni Neagra hc',
  'cfr-40749': 'Lunca Bradului',
  'cfr-40763': 'Andreneasa hc',
  'cfr-40787': 'Răstolița',
  'cfr-40799': 'Borzia',
  'cfr-40804': 'Deda Bistra',
  'cfr-40830': 'Deda',
  'cfr-40866': 'Morăreni hc',
  'cfr-40878': 'Râpa de Jos Hm',
  'cfr-42400': 'Rușii Munți hc',
  'cfr-42412': 'Aluniș Mureș',
  'cfr-42424': 'Aluniș h',
  'cfr-42436': 'Brâncovenești hc',
  'cfr-42448': 'Ideciu de Jos hc',
  'cfr-42474': 'Reghin',
  'cfr-42503': 'Petelea hc',
  'cfr-42527': 'Periș Mureș hc',
  'cfr-42539': 'Gornești Mureș H',
  'cfr-42541': 'Dumbrăvioara',
  'cfr-42577': 'Târgu Mureș Nord',
  'cfr-42606': 'Târgu Mureș',
  'cfr-42620': 'Azomureș hc',
  'cfr-42644': 'Târgu Mureș Sud',
  'cfr-42670': 'General Nicolae Dăscălescu',
  'cfr-42694': 'Vidrasău hc',
  'cfr-42709': 'Chirileu hc',
  'cfr-42711': 'Sânpaul hc',
  'cfr-42723': 'Ogra',
  'cfr-42735': 'Cipău Hm',
  'cfr-42747': 'Iernut',
  'cfr-42761': 'Cuci Hm',
  'cfr-42785': 'Bogata Mureș hc',
  'cfr-42814': 'Luduș',
  'cfr-42840': 'Chețani hc',
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
    return normalizeCurrentCfrName(
      station?.providerNames?.cfr ?? station?.providerName ?? station?.name ?? id,
    )
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

function normalizeCurrentCfrName(value: string) {
  return value
    .replaceAll('Ş', 'Ș')
    .replaceAll('ş', 'ș')
    .replaceAll('Ţ', 'Ț')
    .replaceAll('ţ', 'ț')
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000))
}
