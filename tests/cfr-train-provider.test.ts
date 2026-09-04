import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { CfrTrainProvider } from '../server/providers/cfr-train-provider.js'

const bikeResultsHtml = readFileSync(
  'tests/fixtures/cfr-bike-results.html',
  'utf8',
)

describe('CfrTrainProvider station mapping', () => {
  it('sends the exact official station names for catalog ids', async () => {
    let requestedUrl = ''
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      requestedUrl = input.toString()
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async () => '<div data-empty-results="true"></div>',
      } as Response
    }) as typeof fetch
    const provider = new CfrTrainProvider('https://example.com/itineraries', fetcher, { allowedHosts: ['example.com'] })

    await provider.search({
      from: 'cfr-11906',
      to: 'codlea',
      date: '2026-09-03',
      bike: true,
    })

    const url = new URL(requestedUrl)
    expect(url.searchParams.get('DepartureStationName')).toBe('Timişoara Nord')
    expect(url.searchParams.get('ArrivalStationName')).toBe('Codlea Hm.')
  })

  it('classifies Retry-After responses without parsing their body', async () => {
    const fetcher = vi.fn(async () => new Response('', {
      status: 429,
      headers: { 'retry-after': '45' },
    })) as typeof fetch
    const result = await new CfrTrainProvider('https://example.com/itineraries', fetcher, { allowedHosts: ['example.com'] }).search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })
    expect(result).toMatchObject({ outcome: 'rate_limited', retryAfterSeconds: 45, options: [] })
  })

  it('fails closed for non-HTML and oversized source responses', async () => {
    const jsonFetcher = vi.fn(async () => new Response('{}', {
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const result = await new CfrTrainProvider('https://example.com/itineraries', jsonFetcher, { allowedHosts: ['example.com'] }).search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })
    expect(result.outcome).toBe('invalid_payload')
  })

  it('strips credentials, query and fragments from the public provenance URL', async () => {
    const fetcher = vi.fn(async () => new Response(bikeResultsHtml, {
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch
    const provider = new CfrTrainProvider(
      'https://example.com/itineraries?private=acquisition',
      fetcher,
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
    const fetcher = vi.fn(async () => new Response(bikeResultsHtml, {
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch
    const provider = new CfrTrainProvider(
      'https://example.com/private/token/secret?acquisition=hidden',
      fetcher,
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
