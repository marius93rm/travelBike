import { hasConfiguredCfrAuthorizationReference } from '../server/config/cfr-authorization-reference.mjs'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787'
const MAX_DATA_AGE_MS = 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

// One representative route touches each county in the current pilot. A covered
// empty result is valid: this check verifies the live source path, not service.
const countyRoutes = [
  { county: 'Brașov', from: 'brasov', to: 'codlea' },
  { county: 'Sibiu', from: 'cfr-20232', to: 'cfr-20658' },
  { county: 'Covasna', from: 'cfr-40103', to: 'cfr-40139' },
  { county: 'Mureș', from: 'cfr-31217', to: 'brasov' },
]

function bucharestToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function parseArgs(args) {
  const parsed = {
    baseUrl: process.env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL,
    date: process.env.SMOKE_DATE ?? bucharestToday(),
    confirmAuthorizedLiveTest: false,
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--confirm-authorized-live-test') {
      parsed.confirmAuthorizedLiveTest = true
      continue
    }
    if (argument !== '--base-url' && argument !== '--date') {
      throw new Error(`Argomento non riconosciuto: ${argument}`)
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Valore mancante per ${argument}`)
    }
    if (argument === '--base-url') parsed.baseUrl = value
    else parsed.date = value
    index += 1
  }
  if (!validDate(parsed.date)) {
    throw new Error(`Data non valida: ${parsed.date}. Usa YYYY-MM-DD.`)
  }

  const baseUrl = new URL(parsed.baseUrl)
  if (!['http:', 'https:'].includes(baseUrl.protocol)
    || baseUrl.username
    || baseUrl.password
    || baseUrl.search
    || baseUrl.hash
    || baseUrl.pathname !== '/') {
    throw new Error('--base-url deve essere un origin HTTP(S) senza credenziali o percorso.')
  }
  return {
    baseUrl: baseUrl.origin,
    date: parsed.date,
    confirmAuthorizedLiveTest: parsed.confirmAuthorizedLiveTest,
  }
}

async function readJson(response, description) {
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`${description}: risposta non JSON (HTTP ${response.status}).`)
  }
}

function timestampIsValid(value) {
  if (typeof value !== 'string') return false
  return Number.isFinite(Date.parse(value))
}

function timestampIsCurrent(value, now = Date.now()) {
  if (!timestampIsValid(value)) return false
  const timestamp = Date.parse(value)
  const age = now - timestamp
  return age <= MAX_DATA_AGE_MS && age >= -MAX_CLOCK_SKEW_MS
}

function requireHttpsUrl(value, description) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:'
      && (url.hostname === 'cfrcalatori.ro' || url.hostname.endsWith('.cfrcalatori.ro'))) return
  } catch {
    // Report malformed source values with the same concise field context.
  }
  throw new Error(`${description}: manca una fonte HTTPS CFR valida.`)
}

async function main() {
  const { baseUrl, date, confirmAuthorizedLiveTest } = parseArgs(process.argv.slice(2))
  if (!confirmAuthorizedLiveTest
    || !hasConfiguredCfrAuthorizationReference(process.env.CFR_WRITTEN_AUTHORIZATION_REF)) {
    throw new Error(
      'Smoke CFR invia richieste live. Servono un riferimento reale e non sensibile all’autorizzazione scritta in CFR_WRITTEN_AUTHORIZATION_REF (non un segnaposto) e il flag --confirm-authorized-live-test.',
    )
  }

  const readinessResponse = await fetch(new URL('/api/readiness', baseUrl), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(35_000),
  })
  const readiness = await readJson(readinessResponse, 'Readiness')
  if (!readinessResponse.ok
    || readiness.ok !== true
    || readiness.status !== 'ready'
    || readiness.pilot?.mappingComplete !== true
    || !readiness.pilot?.allowlistVersion
    || readiness.providers?.journeySearch !== 'ready') {
    throw new Error(`Readiness non pronta (HTTP ${readinessResponse.status}): ${JSON.stringify(readiness)}`)
  }

  console.log(`Pilot ${readiness.pilot.allowlistVersion} pronto; verifica live CFR per ${date}.`)
  for (const route of countyRoutes) {
    const url = new URL('/api/trains', baseUrl)
    url.search = new URLSearchParams({
      from: route.from,
      to: route.to,
      date,
      bike: 'true',
    }).toString()
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(35_000),
    })
    const result = await readJson(response, `${route.county} (${route.from} → ${route.to})`)
    const label = `${route.county} (${route.from} → ${route.to})`
    if (!response.ok) throw new Error(`${label}: API HTTP ${response.status}.`)
    if (result.meta?.coverage !== 'covered') {
      throw new Error(`${label}: copertura ${String(result.meta?.coverage)}.`)
    }
    if (!timestampIsCurrent(result.meta?.asOf)) {
      throw new Error(`${label}: timestamp aggregato assente o più vecchio di un'ora.`)
    }
    if (!Array.isArray(result.meta?.sources)
      || !result.meta.sources.some((source) =>
        source.providerId === 'cfr'
        && source.outcome === 'success'
        && timestampIsCurrent(source.fetchedAt))) {
      throw new Error(`${label}: manca una risposta CFR riuscita e aggiornata.`)
    }
    if (!Array.isArray(result.options)) {
      throw new Error(`${label}: il campo options non è un array.`)
    }

    for (const option of result.options) {
      if (option.bikeAllowed !== true || option.bikeType !== 'non_foldable') {
        throw new Error(`${label}: risultato ${option.id ?? '(senza ID)'} viola il filtro bici.`)
      }
      if (!timestampIsCurrent(option.lastVerifiedAt)) {
        throw new Error(`${label}: risultato ${option.id} senza verifica recente.`)
      }
      requireHttpsUrl(option.sourceUrl, `${label}, risultato ${option.id}`)
      const bikeEvidence = [
        ['regulile de rezervare', option.bikeReservationEvidence],
        ['regulile de cumpărare a biletului', option.bikeTicketPurchaseEvidence],
        ['tariful', option.bikeFeeEvidence],
      ]
      for (const [kind, evidence] of bikeEvidence) {
        if (!evidence || !timestampIsValid(evidence.verifiedAt)) {
          throw new Error(
            `${label}: lipsește proveniența cu dată validă pentru ${kind} (rezultatul ${option.id}).`,
          )
        }
        requireHttpsUrl(evidence.sourceUrl, `${label}, ${kind} (rezultatul ${option.id})`)
      }
      if (option.bikeFeeLei !== null && !option.bikeFeeEvidence) {
        throw new Error(`${label}: importo bici privo di provenienza tariffaria.`)
      }
    }

    const sourceNames = result.meta.sources
      .filter((source) => source.outcome === 'success')
      .map((source) => source.providerId)
      .join(', ')
    console.log(`✓ ${label}: coperta, ${result.options.length} corse bici; ${sourceNames}; aggiornato ${result.meta.asOf}.`)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Smoke CFR non riuscito: ${message}`)
  process.exitCode = 1
})
