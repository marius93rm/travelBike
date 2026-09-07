import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { CfrTrainProvider } from '../server/providers/cfr-train-provider.js'

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
    expect(body.get('DepartureStationName')).toBe('Timişoara Nord')
    expect(body.get('ArrivalStationName')).toBe('Codlea')
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
