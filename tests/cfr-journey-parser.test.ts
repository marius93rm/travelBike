import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCfrJourneyHtml } from '../server/providers/cfr-journey-parser.js'

describe('parseCfrJourneyHtml', () => {
  it('normalizes only rows with an explicit bicycle service indicator', async () => {
    const html = await readFile(
      path.resolve(process.cwd(), 'tests/fixtures/cfr-bike-results.html'),
      'utf8',
    )

    const options = parseCfrJourneyHtml(
      html,
      {
        from: 'codlea',
        to: 'brasov',
        date: '2026-09-03',
        bike: true,
      },
      'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
      '2026-09-03T14:20:00+03:00',
    )

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({
      trainCategory: 'IR',
      trainNumber: '1622',
      bikeAllowed: true,
      bikeCapacity: null,
      reliability: 'official',
    })
  })

  it('fails closed when the upstream markup is no longer recognized', () => {
    expect(() =>
      parseCfrJourneyHtml(
        '<html><body><div>structură nouă</div></body></html>',
        {
          from: 'codlea',
          to: 'brasov',
          date: '2026-09-03',
          bike: true,
        },
        'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
      ),
    ).toThrow('markup is not recognized')
  })

  it('does not treat negative bicycle text as positive evidence', () => {
    expect(() =>
      parseCfrJourneyHtml(
        `<article data-itinerary data-connection-count="0" data-train-category="R" data-train-number="3001" data-departure-time="10:00" data-arrival-time="10:30">
          <span title="Biciclete neacceptate">Biciclete neacceptate</span>
        </article>`,
        {
          from: 'codlea',
          to: 'brasov',
          date: '2026-09-03',
          bike: true,
        },
        'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
      ),
    ).toThrow('bicycle or direct-journey markers are not recognized')
  })

  it('returns an authoritative empty list only for an explicit empty state', () => {
    expect(
      parseCfrJourneyHtml(
        '<div class="no-results">Niciun tren găsit</div>',
        {
          from: 'codlea',
          to: 'brasov',
          date: '2026-09-03',
          bike: true,
        },
        'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
      ),
    ).toEqual([])
  })

  it('does not confuse maintenance copy with a structured empty state', () => {
    expect(() =>
      parseCfrJourneyHtml(
        '<div class="maintenance">Eroare tehnică: niciun tren nu poate fi afișat momentan.</div>',
        {
          from: 'codlea',
          to: 'brasov',
          date: '2026-09-03',
          bike: true,
        },
        'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
      ),
    ).toThrow('markup is not recognized')
  })

  it('places an overnight arrival on the following service day', () => {
    const [option] = parseCfrJourneyHtml(
      `<article data-itinerary data-bike-service="true" data-connection-count="0"
        data-train-category="IR" data-train-number="999"
        data-departure-time="23:40" data-arrival-time="00:25">IR 999</article>`,
      {
        from: 'brasov',
        to: 'cfr-20658',
        date: '2026-09-03',
        bike: true,
      },
      'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
    )

    expect(option.departureAt).toMatch(/^2026-09-03T23:40/)
    expect(option.arrivalAt).toMatch(/^2026-09-04T00:25/)
    expect(option.durationMinutes).toBe(45)
  })
})
