export const PROVIDER_FAILURE_WARNING =
  'Sursa nu a putut verifica ruta acum. Nu afișăm orare neverificate.'

export const PROVIDER_FRESHNESS_WARNING =
  'Datele providerului nu se încadrează în fereastra de actualitate de o oră.'

export const PROVIDER_INVALID_RESULT_WARNING =
  'Nu am putut valida ruta și data returnate de sursă. Nu afișăm orare neverificate.'

export const PROVIDER_CACHE_STALE_WARNING =
  'Datele providerului sunt mai vechi de o oră sau au un marcaj temporal invalid.'

export const CONTROLLED_PROVIDER_WARNINGS = {
  rateLimited: 'Bugetul de cereri către CFR a fost epuizat temporar.',
  circuitOpen: 'Circuitul CFR este deschis după erori repetate.',
} as const

export const FALLBACK_PROVIDER_WARNINGS = {
  liveUnavailable: 'Datele demonstrative nu sunt disponibile în căutarea live.',
  demoOnly: 'Date demonstrative verificate la 3 septembrie 2026; nu reprezintă acoperire live.',
  discoveryUnavailable: 'Explorarea destinațiilor nu este disponibilă pentru date demonstrative.',
} as const

export const CFR_FAILURE_WARNINGS = {
  unsupported: 'Sursa CFR nu acceptă această rută.',
  unavailable: 'CFR nu a putut verifica ruta acum. Nu afișăm orare neverificate.',
  rate_limited: 'CFR limitează temporar cererile. Încearcă din nou mai târziu.',
  invalid_payload: 'Nu am putut valida răspunsul CFR. Nu afișăm orare neverificate.',
} as const

const SAFE_PROVIDER_WARNINGS = new Set<string>([
  ...Object.values(CFR_FAILURE_WARNINGS),
  ...Object.values(CONTROLLED_PROVIDER_WARNINGS),
  ...Object.values(FALLBACK_PROVIDER_WARNINGS),
  PROVIDER_FAILURE_WARNING,
  PROVIDER_FRESHNESS_WARNING,
  PROVIDER_INVALID_RESULT_WARNING,
  PROVIDER_CACHE_STALE_WARNING,
])

/** Keep provider-supplied text at the public boundary to reviewed product copy. */
export function safeProviderWarning(warning: unknown): string | null {
  return typeof warning === 'string' && SAFE_PROVIDER_WARNINGS.has(warning)
    ? warning
    : null
}
