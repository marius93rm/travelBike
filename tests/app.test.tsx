import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App.js'
import type {
  DestinationSearchResponse,
  TrainSearchResponse,
} from '../src/domain/train.js'

const response: TrainSearchResponse = {
  options: [
    {
      id: 'cfr-ir-1622-codlea-brasov',
      trainNumber: '1622',
      trainCategory: 'IR',
      operator: 'CFR Călători',
      departureStationId: 'codlea',
      arrivalStationId: 'brasov',
      departureAt: '2026-09-03T19:17:00+03:00',
      arrivalAt: '2026-09-03T19:40:00+03:00',
      durationMinutes: 23,
      bikeAllowed: true,
      bikeType: 'non_foldable',
      bikeReservation: 'unknown',
      bikeCapacity: null,
      bikeFeeLei: 8,
      source: 'CFR Călători',
      sourceUrl: 'https://www.cfrcalatori.ro/',
      lastVerifiedAt: '2026-09-03T14:20:00+03:00',
      reliability: 'fallback',
    },
  ],
  meta: {
    providerId: 'fallback',
    reliability: 'fallback',
    fetchedAt: '2026-09-03T14:20:00+03:00',
    degraded: false,
    warning: null,
  },
}

const destinationResponse: DestinationSearchResponse = {
  options: [{
    destinationStationId: 'codlea',
    departures: [{
      ...response.options[0],
      id: 'outbound-1621',
      trainNumber: '1621',
      departureStationId: 'brasov',
      arrivalStationId: 'codlea',
      departureAt: '2026-09-03T12:32:00+03:00',
      arrivalAt: '2026-09-03T12:55:00+03:00',
      changes: 0,
    }],
    returns: [{
      ...response.options[0],
      id: 'return-1622',
      departureAt: '2026-09-03T19:17:00+03:00',
      arrivalAt: '2026-09-03T19:40:00+03:00',
      changes: 0,
    }],
  }],
  meta: response.meta,
}

describe('BikeTrain app', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('swaps departure and arrival stations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByLabelText('De la')).toHaveValue('Codlea')
    expect(screen.getByLabelText('La')).toHaveValue('Brașov')

    await user.click(screen.getByRole('button', { name: 'Inversează direcția' }))

    expect(screen.getByLabelText('De la')).toHaveValue('Brașov')
    expect(screen.getByLabelText('La')).toHaveValue('Codlea')
  })

  it('finds and selects a station without requiring Romanian diacritics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...response, options: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    const departure = screen.getByLabelText('De la')
    await user.clear(departure)
    await user.type(departure, 'timisoara')
    await user.click(screen.getByRole('option', { name: /Timișoara Nord/i }))
    await user.click(screen.getByRole('button', { name: 'Caută trenuri' }))

    expect(screen.getByLabelText('De la')).toHaveValue('Timișoara Nord')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('from=cfr-11906'),
      expect.any(Object),
    )
  })

  it('does not search with free text that is not a selected station', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    const departure = screen.getByLabelText('De la')
    await user.clear(departure)
    await user.type(departure, 'Oraș imaginar')
    await user.click(screen.getByRole('button', { name: 'Caută trenuri' }))

    expect(departure).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Selectează o stație din lista de sugestii.')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('selects the active station suggestion with the keyboard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    const user = userEvent.setup()
    render(<App />)

    const arrival = screen.getByLabelText('La')
    await user.clear(arrival)
    await user.type(arrival, 'sibiu')
    await user.keyboard('{Enter}')

    expect(screen.getByLabelText('La')).toHaveValue('Sibiu')
    expect(screen.getByLabelText('La')).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows unknown bike capacity without implying availability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    render(<App />)

    expect(await screen.findByText('Locuri biciclete: disponibilitate necunoscută')).toBeVisible()
    expect(screen.queryByText('Locuri biciclete: disponibile')).not.toBeInTheDocument()
  })

  it('visibly distinguishes fallback data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    render(<App />)

    expect(await screen.findByText('Date de rezervă verificate')).toBeVisible()
  })

  it('discovers a direct destination and opens it in route search', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString()
      return {
        ok: true,
        json: async () => url.startsWith('/api/coverage')
          ? {
              pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
              route: { supported: true, coverage: 'available', providerStatus: 'ready' },
              discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
            }
          : url.startsWith('/api/destinations')
            ? destinationResponse
            : response,
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Unde pot ajunge?' }))
    expect(screen.getByLabelText('Plecare din')).toHaveValue('Brașov')

    const destinationButton = screen.getByRole('button', { name: 'Arată destinațiile' })
    await vi.waitFor(() => expect(destinationButton).toBeEnabled())
    await user.click(destinationButton)

    expect(await screen.findByRole('heading', { name: 'Codlea' })).toBeVisible()
    expect(screen.getByRole('heading', {
      name: 'Unde poți merge și când te poți întoarce',
    })).toHaveFocus()
    expect(screen.getByText('IR 1621')).toBeVisible()
    expect(screen.getByText('IR 1622')).toBeVisible()
    expect(screen.getByText('Dus direct')).toBeVisible()
    expect(screen.getByText('Întors direct')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Vezi ruta Brașov – Codlea' }))

    expect(screen.getByLabelText('De la')).toHaveValue('Brașov')
    expect(screen.getByLabelText('La')).toHaveValue('Codlea')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/trains?from=brasov&to=codlea'),
      expect.any(Object),
    )
  })

  it('switches search modes with arrow keys', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    const user = userEvent.setup()
    render(<App />)

    const routeTab = screen.getByRole('tab', { name: 'Caută o rută' })
    routeTab.focus()
    await user.keyboard('{ArrowRight}')

    const discoverTab = screen.getByRole('tab', { name: 'Unde pot ajunge?' })
    expect(discoverTab).toHaveAttribute('aria-selected', 'true')
    expect(discoverTab).toHaveFocus()
  })

  it('describes the regional pilot and provides a skip link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))

    render(<App />)

    expect(screen.getByRole('link', { name: 'Sari la conținut' })).toHaveAttribute('href', '#main')
    expect(screen.getByText('Pilot Transilvania centrală')).toBeVisible()
    expect(screen.queryByText('Catalog național')).not.toBeInTheDocument()
  })

  it('distinguishes missing coverage from a confirmed empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        options: [],
        meta: {
          ...response.meta,
          providerId: 'none',
          coverage: 'unsupported',
          asOf: null,
          partial: false,
          degraded: true,
          sources: [],
        },
      }),
    }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Ruta nu este încă acoperită de pilot.' })).toBeVisible()
    expect(screen.queryByText('Niciun tren cu transport pentru biciclete găsit pentru această rută și dată.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vezi ziua următoare' })).not.toBeInTheDocument()
  })

  it('shows temporary source failure separately from unsupported coverage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        options: [],
        meta: {
          ...response.meta,
          providerId: 'cfr',
          coverage: 'unavailable',
          asOf: null,
          partial: false,
          degraded: true,
          sources: [{ providerId: 'cfr', outcome: 'unavailable', fetchedAt: null, warning: null }],
        },
      }),
    }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Datele CFR sunt temporar indisponibile.' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible()
  })

  it('checks discovery capability before offering a destination search', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => input.toString().startsWith('/api/coverage')
        ? {
            pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
            route: { supported: true, coverage: 'available', providerStatus: 'ready' },
            discovery: { supported: false, coverage: 'unsupported', providerStatus: 'unsupported' },
          }
        : response,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Unde pot ajunge?' }))

    expect(await screen.findByRole('heading', { name: 'Explorarea nu este disponibilă în acest pilot.' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Arată destinațiile' })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([input]) => input.toString().startsWith('/api/destinations'))).toBe(false)
  })
})
