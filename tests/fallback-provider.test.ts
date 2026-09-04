import { describe, expect, it } from 'vitest'
import { FallbackTrainProvider } from '../server/providers/fallback-train-provider.js'

describe('FallbackTrainProvider', () => {
  const provider = new FallbackTrainProvider({ demoEnabled: true })

  it('returns only IR 1622 from Codlea to Brașov', async () => {
    const result = await provider.search({
      from: 'codlea',
      to: 'brasov',
      date: '2026-09-03',
      bike: true,
    })

    expect(result.options.map((train) => train.trainNumber)).toEqual(['1622'])
    expect(result.options[0]).toMatchObject({
      departureStationId: 'codlea',
      arrivalStationId: 'brasov',
      bikeAllowed: true,
      bikeCapacity: null,
      bikeFeeLei: 8,
      reliability: 'fallback',
    })
  })

  it('returns only IR 1621 from Brașov to Codlea', async () => {
    const result = await provider.search({
      from: 'brasov',
      to: 'codlea',
      date: '2026-09-03',
      bike: true,
    })

    expect(result.options.map((train) => train.trainNumber)).toEqual(['1621'])
  })

  it('does not project fallback trains onto an unverified date', async () => {
    const result = await provider.search({
      from: 'codlea',
      to: 'brasov',
      date: '2026-09-04',
      bike: true,
    })

    expect(result.options).toEqual([])
  })

  it('is disabled by default so stale fixtures cannot represent live coverage', async () => {
    const result = await new FallbackTrainProvider().search({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: true,
    })
    expect(result).toMatchObject({ outcome: 'unsupported', options: [] })
  })
})
