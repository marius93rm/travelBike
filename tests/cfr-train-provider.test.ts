import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { CfrTrainProvider } from '../server/providers/cfr-train-provider.js'
import { journeyDateBounds } from '../src/domain/journey-date.js'

const bikeResultsHtml = readFileSync(
  'tests/fixtures/cfr-bike-results.html',
  'utf8',
)

const searchPageHtml = `
  <form id="form-search">
    <input name="ArrivalStationName" value="Brașov" />
    <input name="ConfirmationKey" value="session-confirmation" />
    <input name="__RequestVerificationToken" value="request-token" />
  </form>
`

function htmlResponse(html: string, headers: Record<string, string> = {}) {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  })
}

describe('CfrTrainProvider station mapping', () => {
  it('does not expose upstream exception details in the public warning', async () => {
    const privateDiagnostic = 'Authorization: Bearer private-session-token'
    const provider = new CfrTrainProvider(
      'https://example.com/itineraries',
      vi.fn(async () => { throw new Error(privateDiagnostic) }) as typeof fetch,
      { allowedHosts: ['example.com'] },
    )

    const result = await provider.search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })

    expect(result.warning).toContain('Nu afișăm orare neverificate')
    expect(result.warning).not.toContain(privateDiagnostic)
  })

  it('rejects acquisition URLs with credentials or non-standard HTTPS ports', () => {
    const fetcher = vi.fn() as typeof fetch

    expect(() => new CfrTrainProvider(
      'https://user:secret@example.com/itineraries',
      fetcher,
      { allowedHosts: ['example.com'] },
    )).toThrow(/without credentials or a non-standard port/i)
    expect(() => new CfrTrainProvider(
      'https://example.com:8443/itineraries',
      fetcher,
      { allowedHosts: ['example.com'] },
    )).toThrow(/without credentials or a non-standard port/i)
  })

  it('does not follow a redirect away from the configured acquisition host', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void input
      void init
      return new Response('', {
        status: 302,
        headers: { location: 'http://127.0.0.1/latest/meta-data' },
      })
    })
    const provider = new CfrTrainProvider(
      'https://example.com/itineraries',
      fetcher as typeof fetch,
      { allowedHosts: ['example.com'] },
    )

    const result = await provider.search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })

    expect(result).toMatchObject({ outcome: 'unavailable', options: [] })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error')
  })

  it('does not follow a redirect after posting the CFR search form', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void input
      void init
      return fetcher.mock.calls.length === 1
        ? htmlResponse(searchPageHtml, { 'set-cookie': 'session=private; Path=/' })
        : new Response('', {
          status: 302,
          headers: { location: 'https://outside.example/results' },
        })
    })
    const provider = new CfrTrainProvider(
      'https://example.com/itineraries',
      fetcher as typeof fetch,
      { allowedHosts: ['example.com'] },
    )

    const result = await provider.search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })

    expect(result).toMatchObject({ outcome: 'unavailable', options: [] })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]?.[1]?.redirect).toBe('error')
  })

  it('rejects public provenance URLs with a non-standard HTTPS port', () => {
    expect(() => new CfrTrainProvider(
      'https://example.com/itineraries',
      vi.fn() as typeof fetch,
      {
        allowedHosts: ['example.com'],
        publicSourceUrl: 'https://example.com:8443/ro-RO/Itineraries',
      },
    )).toThrow(/explicitly allowed HTTPS host/i)
  })

  it('exposes sanitized public source information independently from the acquisition URL', () => {
    const provider = new CfrTrainProvider(
      'https://example.com/private/search',
      vi.fn() as typeof fetch,
      {
        allowedHosts: ['example.com'],
        publicSourceUrl: 'https://example.com/ro-RO/Itineraries?session=private#results',
      },
    )

    expect(provider.sourceInfo).toEqual({
      name: 'CFR Călători',
      url: 'https://example.com/ro-RO/Itineraries',
    })
  })

  it('sends the exact official station names for catalog ids', async () => {
    let requestedUrl = ''
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init
      requestedUrl = input.toString()
      return fetcher.mock.calls.length === 1
        ? htmlResponse(searchPageHtml)
        : htmlResponse('<div data-empty-results="true"></div>')
    })
    const provider = new CfrTrainProvider('https://example.com/itineraries', fetcher as typeof fetch, { allowedHosts: ['example.com'] })

    await provider.search({
      from: 'cfr-11906',
      to: 'codlea',
      date: '2026-09-03',
      bike: true,
    })

    const body = new URLSearchParams(fetcher.mock.calls[1]?.[1]?.body as string)
    expect(requestedUrl).toContain('/ro-RO/Itineraries/GetItineraries')
    expect(body.get('DepartureStationName')).toBe('Timișoara Nord')
    expect(body.get('ArrivalStationName')).toBe('Codlea')
  })

  it('uses current commercial labels for pilot stations', async () => {
    let requestedUrl = ''
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init
      requestedUrl = input.toString()
      return fetcher.mock.calls.length === 1
        ? htmlResponse(searchPageHtml)
        : htmlResponse('<div data-empty-results="true"></div>')
    })
    const provider = new CfrTrainProvider('https://example.com/itineraries', fetcher as typeof fetch, { allowedHosts: ['example.com'] })

    await provider.search({
      from: 'cfr-20658',
      to: 'cfr-20775',
      date: '2026-09-03',
      bike: true,
    })

    const body = new URLSearchParams(fetcher.mock.calls[1]?.[1]?.body as string)
    expect(requestedUrl).toContain('/ro-RO/Itineraries/GetItineraries')
    expect(body.get('DepartureStationName')).toBe('Sibiu')
    expect(body.get('ArrivalStationName')).toBe('Cristian Sibiu')
  })

  it('provides a public CFR planner link with the route, date, and bike filter prefilled', async () => {
    const fetcher = vi.fn(async () => fetcher.mock.calls.length === 1
      ? htmlResponse(searchPageHtml)
      : htmlResponse(bikeResultsHtml))
    const provider = new CfrTrainProvider(
      'https://example.com/itineraries',
      fetcher as typeof fetch,
      { allowedHosts: ['example.com'], publicSourceUrl: 'https://example.com/ro-RO/Itineraries' },
    )

    const result = await provider.search({
      from: 'cfr-20658',
      to: 'codlea',
      date: journeyDateBounds().min,
      bike: true,
    })

    const option = result.options[0]
    const bookingUrl = new URL(option?.bookingUrl ?? '')
    expect(bookingUrl.hostname).toBe('example.com')
    expect(bookingUrl.pathname).toBe('/ro-RO/Itineraries')
    expect(bookingUrl.searchParams.get('DepartureStationName')).toBe('Sibiu')
    expect(bookingUrl.searchParams.get('ArrivalStationName')).toBe('Codlea')
    expect(bookingUrl.searchParams.get('DepartureDate')).toBe(
      journeyDateBounds().min.split('-').reverse().join('.'),
    )
    expect(bookingUrl.searchParams.get('IsBikesServiceRequired')).toBe('True')
    expect(option?.sourceUrl).toBe('https://example.com/ro-RO/Itineraries')
  })

  it('classifies Retry-After responses without parsing their body', async () => {
    const fetcher = vi.fn(async () => new Response('', {
      status: 429, headers: { 'retry-after': '45' },
    }))
    const result = await new CfrTrainProvider('https://example.com/itineraries', fetcher as typeof fetch, { allowedHosts: ['example.com'] }).search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })
    expect(result).toMatchObject({ outcome: 'rate_limited', retryAfterSeconds: 45, options: [] })
  })

  it('fails closed for non-HTML and oversized source responses', async () => {
    const jsonFetcher = vi.fn(async () => new Response('{}', {
      headers: { 'content-type': 'application/json' },
    }))
    const result = await new CfrTrainProvider('https://example.com/itineraries', jsonFetcher as typeof fetch, { allowedHosts: ['example.com'] }).search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })
    expect(result.outcome).toBe('invalid_payload')

    let chunksPulled = 0
    let streamCancelled = false
    const oversizedBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksPulled += 1
        controller.enqueue(new TextEncoder().encode('123456'))
        if (chunksPulled === 4) controller.close()
      },
      cancel() { streamCancelled = true },
    })
    const oversizedFetcher = vi.fn(async () => new Response(oversizedBody, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }))
    const oversizedResult = await new CfrTrainProvider(
      'https://example.com/itineraries',
      oversizedFetcher as typeof fetch,
      { allowedHosts: ['example.com'], maxBodyBytes: 8 },
    ).search({ from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true })

    expect(oversizedResult.outcome).toBe('invalid_payload')
    expect(oversizedFetcher).toHaveBeenCalledTimes(1)
    expect(chunksPulled).toBeLessThan(4)
    expect(streamCancelled).toBe(true)
  })

  it('strips credentials, query and fragments from the public provenance URL', async () => {
    const fetcher = vi.fn(async () => fetcher.mock.calls.length === 1
      ? htmlResponse(searchPageHtml)
      : htmlResponse(bikeResultsHtml))
    const provider = new CfrTrainProvider(
      'https://example.com/itineraries?private=acquisition',
      fetcher as typeof fetch,
      {
        allowedHosts: ['example.com'],
        publicSourceUrl: 'https://user:pass@example.com/journey?access_token=secret#private',
      },
    )

    const result = await provider.search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })

    expect(result.outcome).toBe('success')
    expect(result.options[0]?.sourceUrl).toBe('https://example.com/journey')
  })

  it('never derives the public URL from a private acquisition path', async () => {
    const fetcher = vi.fn(async () => fetcher.mock.calls.length === 1
      ? htmlResponse(searchPageHtml)
      : htmlResponse(bikeResultsHtml))
    const provider = new CfrTrainProvider(
      'https://example.com/private/token/secret?acquisition=hidden',
      fetcher as typeof fetch,
      { allowedHosts: ['example.com'] },
    )

    const result = await provider.search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })

    expect(result.options[0]?.sourceUrl).toBe(
      'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
    )
    expect(JSON.stringify(result)).not.toContain('token/secret')
    expect(JSON.stringify(result)).not.toContain('acquisition=hidden')
  })
})
