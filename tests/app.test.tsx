import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { journeyDateBounds } from '../src/domain/journey-date.js'
import { App } from '../src/app/App.js'
import type {
  CoverageResponse,
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
    cacheStatus: 'live',
    fetchedAt: '2026-09-03T14:20:00+03:00',
    asOf: '2026-09-03T14:20:00+03:00',
    degraded: false,
    warning: null,
  },
}

const timeFilterResponse: TrainSearchResponse = {
  ...response,
  options: [
    { ...response.options[0], id: 'evening-train', trainNumber: '1626', departureAt: '2026-10-22T15:00:00Z', arrivalAt: '2026-10-22T15:20:00Z' },
    { ...response.options[0], id: 'morning-train', trainNumber: '1622', departureAt: '2026-10-22T06:59:00Z', arrivalAt: '2026-10-22T07:20:00Z' },
    { ...response.options[0], id: 'midday-train', trainNumber: '1624', departureAt: '2026-10-22T07:00:00Z', arrivalAt: '2026-10-22T07:20:00Z' },
  ],
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
    }, {
      ...response.options[0],
      id: 'return-1630',
      trainNumber: '1630',
      departureAt: '2026-09-03T20:17:00+03:00',
      arrivalAt: '2026-09-03T20:40:00+03:00',
      changes: 0,
    }],
  }],
  meta: response.meta,
}

const discoveryAvailable: CoverageResponse = {
  pilot: { region: 'test', mappingComplete: true, source: 'default_hubs' },
  route: { supported: true, coverage: 'available', providerStatus: 'ready' },
  discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
}

function renderAppWithRoute(options: { mockDiscovery?: boolean } = {}) {
  const date = journeyDateBounds().min
  window.history.replaceState(null, '', `/?from=codlea&to=brasov&date=${date}`)
  if (options.mockDiscovery !== false && vi.isMockFunction(window.fetch)) {
    const originalFetch = window.fetch as unknown as (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<unknown>
    const fetchWithDiscovery = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/coverage')) {
        return Promise.resolve({ ok: true, json: async () => discoveryAvailable })
      }
      return originalFetch(input, init)
    })
    vi.stubGlobal('fetch', fetchWithDiscovery)
  }
  return render(<App />)
}

describe('BikeTrain app', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('starts with empty route fields and waits for the user before requesting data', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(screen.getByLabelText('De la')).toHaveValue('')
    expect(screen.getByLabelText('La')).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Alege o rută ca să începem.' })).toBeVisible()
    expect(screen.queryByRole('tab', { name: 'Unde pot ajunge?' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks for valid stations before starting a route search', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Caută trenuri' }))

    expect(screen.getByLabelText('De la')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('La')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('Selectează o stație din lista de sugestii.')).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('restores a shared route and sends that route through the native share menu', async () => {
    const date = journeyDateBounds().min
    window.history.replaceState(null, '', '/?from=codlea&to=brasov&date=' + date)
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const payload = input.toString().startsWith('/api/coverage') ? discoveryAvailable : response
      return Promise.resolve({ ok: true, json: async () => payload })
    })
    vi.stubGlobal('fetch', fetchMock)
    const shareMock = vi.fn().mockResolvedValue(undefined)
    const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
    Object.defineProperty(navigator, 'share', { configurable: true, value: shareMock })
    const user = userEvent.setup()

    try {
      render(<App />)

      expect(screen.getByLabelText('De la')).toHaveValue('Codlea')
      expect(screen.getByLabelText('La')).toHaveValue('Brașov')
      await screen.findByText('IR 1622')
      await user.click(screen.getByRole('button', { name: 'Distribuie căutarea' }))

      expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Căutare BikeTrain',
        url: expect.stringContaining('from=codlea&to=brasov&date=' + date),
      }))
      expect(await screen.findByText('Căutarea a fost distribuită.')).toBeVisible()
    } finally {
      if (originalShare) Object.defineProperty(navigator, 'share', originalShare)
      else Reflect.deleteProperty(navigator, 'share')
    }
  })

  it('swaps departure and arrival stations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    const user = userEvent.setup()
    renderAppWithRoute()

    expect(screen.getByLabelText('De la')).toHaveValue('Codlea')
    expect(screen.getByLabelText('La')).toHaveValue('Brașov')

    await user.click(screen.getByRole('button', { name: 'Inversează direcția' }))

    expect(screen.getByLabelText('De la')).toHaveValue('Brașov')
    expect(screen.getByLabelText('La')).toHaveValue('Codlea')
  })

  it('lets the user repeat a recent route search during the current page session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    expect(await screen.findByText('IR 1622')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Inversează direcția' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const recentRoute = await screen.findByRole('button', { name: /Caută din nou Codlea către Brașov/ })
    expect(screen.getByText('Căutări recente')).toBeVisible()
    expect(screen.getByText(/dispar la reîncărcarea paginii/i)).toBeVisible()
    await user.click(recentRoute)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/trains?from=codlea&to=brasov'),
      expect.any(Object),
    )
  })

  it('lets the user remove one recent route or clear the recent searches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    expect(await screen.findByText('IR 1622')).toBeVisible()
    const searchButton = screen.getByRole('button', { name: 'Caută trenuri' })
    await user.click(screen.getByRole('button', { name: 'Inversează direcția' }))
    await waitFor(() => expect(searchButton).toBeEnabled())

    const nextDateValue = new Date(`${journeyDateBounds().min}T12:00:00Z`)
    nextDateValue.setUTCDate(nextDateValue.getUTCDate() + 1)
    const nextDate = nextDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: nextDate } })
    await user.click(searchButton)
    await waitFor(() => expect(searchButton).toBeEnabled())

    await user.click(screen.getByRole('button', { name: /Elimină ruta Codlea → Brașov/ }))
    expect(screen.queryByRole('button', { name: /Caută din nou Codlea către Brașov/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Brașov → Codlea/ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Șterge toate căutările recente' }))
    expect(screen.queryByText('Căutări recente')).not.toBeInTheDocument()
  })

  it('shows a network error and recovers when the user retries', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    renderAppWithRoute()

    expect(await screen.findByRole('heading', {
      name: 'Nu am putut verifica trenurile acum.',
    })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Nu am putut verifica trenurile acum.')
    expect(screen.getByText(
      'Încearcă din nou. Nu vom afișa trenuri fără serviciu confirmat pentru biciclete.',
    )).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Încearcă din nou' }))

    expect(await screen.findByText('IR 1622')).toBeVisible()
    expect(screen.queryByRole('heading', {
      name: 'Nu am putut verifica trenurile acum.',
    })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 tren compatibil găsit.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the API returns a train without confirmed non-foldable bike service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: response.options.map((train) => ({ ...train, bikeAllowed: false })),
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByRole('heading', {
      name: 'Nu am putut verifica trenurile acum.',
    })).toBeVisible()
    expect(screen.queryByText('IR 1622')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Nu am putut verifica trenurile acum.')
  })

  it('announces the catalog expiry before searches are disabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T09:00:00+03:00'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    renderAppWithRoute()

    const warning = screen.getByRole('note')
    expect(warning).toHaveTextContent('Catalogul CFR verificat va expira în curând.')
    expect(warning).toHaveTextContent(/valabil până la 12 decembrie 2026/)
  })

  it('finds and selects a station without requiring Romanian diacritics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...response, options: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

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
    renderAppWithRoute()

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
    renderAppWithRoute()

    const arrival = screen.getByLabelText('La')
    await user.clear(arrival)
    await user.type(arrival, 'sibiu')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByLabelText('La')).toHaveValue('Sibiu')
    expect(screen.getByLabelText('La')).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows unknown bike capacity without implying availability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    renderAppWithRoute()

    expect(await screen.findByText('Locuri biciclete: disponibilitate necunoscută')).toBeVisible()
    expect(screen.getByText(
      'Afișăm doar curse directe cu serviciu de bicicletă confirmat, nu și locurile rămase. Călătoriți în grup? Verificați la operator locurile pentru toți și câte un bilet pentru fiecare bicicletă.',
    )).toBeVisible()
    expect(screen.queryByText('Locuri biciclete: disponibile')).not.toBeInTheDocument()
  })

  it('filters departures by Romanian local time and updates the visible result count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => timeFilterResponse,
    }))
    const user = userEvent.setup()
    const { container } = renderAppWithRoute()

    expect(await screen.findByRole('heading', { name: 'IR 1622' })).toBeVisible()
    const departureFilter = screen.getByLabelText('Ora plecării')

    await user.selectOptions(departureFilter, '10')

    expect(screen.queryByRole('heading', { name: 'IR 1622' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'IR 1624' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'IR 1626' })).toBeVisible()
    expect(screen.getByText('2 din 3 trenuri afișate.')).toBeVisible()
    expect([...container.querySelectorAll('.train-card h3')].map((heading) => heading.textContent))
      .toEqual(['IR 1624', 'IR 1626'])

    await user.selectOptions(departureFilter, '18')

    expect(screen.queryByRole('heading', { name: 'IR 1624' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'IR 1626' })).toBeVisible()
    expect(screen.getByText('1 din 3 trenuri afișate.')).toBeVisible()
  })

  it('offers to restore all trains when a time filter has no matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...timeFilterResponse, options: timeFilterResponse.options.slice(1) }),
    }))
    const user = userEvent.setup()
    renderAppWithRoute()

    expect(await screen.findByRole('heading', { name: 'IR 1622' })).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Ora plecării'), '18')

    expect(screen.getByText('Nu există trenuri cu plecări de la 18:00.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Arată toate trenurile' }))

    expect(screen.getByRole('heading', { name: 'IR 1622' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'IR 1624' })).toBeVisible()
  })

  it('visibly distinguishes fallback data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    renderAppWithRoute()

    expect(await screen.findByText('Date de rezervă verificate')).toBeVisible()
    expect(screen.getByRole('link', { name: /Verifică disponibilitatea și cumpără pe CFR/ })).toHaveAttribute(
      'href',
      response.options[0].sourceUrl,
    )
  })

  it('keeps the result context tied to the submitted search when the draft changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const { container } = renderAppWithRoute()

    const searchButton = screen.getByRole('button', { name: 'Caută trenuri' })
    await waitFor(() => expect(searchButton).toBeEnabled())
    const submittedContext = container.querySelector('.results-criteria')!
    expect(submittedContext).toHaveTextContent('Rezultate pentru Codlea → Brașov')
    expect(submittedContext.querySelector('time')).toHaveAttribute(
      'dateTime',
      journeyDateBounds().min,
    )

    const submittedDate = journeyDateBounds().min
    const nextDateValue = new Date(`${submittedDate}T12:00:00Z`)
    nextDateValue.setUTCDate(nextDateValue.getUTCDate() + 1)
    const nextDate = nextDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: nextDate } })

    expect(screen.getByLabelText('Data')).toHaveValue(nextDate)
    expect(container.querySelector('.results-criteria time')).toHaveAttribute(
      'dateTime',
      submittedDate,
    )

    await user.click(searchButton)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(searchButton).toBeEnabled())
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining(`date=${nextDate}`),
      expect.any(Object),
    )
    await waitFor(() => expect(container.querySelector('.results-criteria time')).toHaveAttribute(
      'dateTime',
      nextDate,
    ))
  })

  it('hides a previous source warning while a new route search is pending', async () => {
    const oldWarning = 'Avertisment din căutarea precedentă.'
    let finishPendingSearch: ((value: { ok: true; json: () => Promise<TrainSearchResponse> }) => void) | undefined
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...response, meta: { ...response.meta, warning: oldWarning } }),
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishPendingSearch = resolve
      }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    expect(await screen.findByText(oldWarning)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Caută trenuri' }))

    const searchButton = screen.getByRole('button', { name: 'Caută trenuri' })
    expect(searchButton).toBeDisabled()
    expect(screen.queryByText(oldWarning)).not.toBeInTheDocument()

    finishPendingSearch?.({ ok: true, json: async () => response })
    await waitFor(() => expect(searchButton).toBeEnabled())
  })

  it('ignores an older route response that arrives after a newer search', async () => {
    type MockResponse = { ok: true; json: () => Promise<TrainSearchResponse> }
    const pendingResponses: Array<(value: MockResponse) => void> = []
    let routeAttempts = 0
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (input.toString().startsWith('/api/trains') && routeAttempts++ === 0) {
        return Promise.resolve({ ok: true, json: async () => response })
      }
      return new Promise<MockResponse>((resolve) => pendingResponses.push(resolve))
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    const searchButton = screen.getByRole('button', { name: 'Caută trenuri' })
    await waitFor(() => expect(searchButton).toBeEnabled())
    const swapButton = screen.getByRole('button', { name: 'Inversează direcția' })

    await user.click(swapButton)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await user.click(swapButton)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const olderResponse: TrainSearchResponse = {
      ...response,
      options: [{ ...response.options[0], id: 'older-result', trainNumber: '2222' }],
    }
    const newerResponse: TrainSearchResponse = {
      ...response,
      options: [{ ...response.options[0], id: 'newer-result', trainNumber: '3333' }],
    }

    await act(async () => pendingResponses[1]({ ok: true, json: async () => newerResponse }))
    expect(await screen.findByText('IR 3333')).toBeVisible()

    await act(async () => pendingResponses[0]({ ok: true, json: async () => olderResponse }))
    expect(screen.getByText('IR 3333')).toBeVisible()
    expect(screen.queryByText('IR 2222')).not.toBeInTheDocument()
  })

  it('ignores an older coverage lookup after the discovery date changes', async () => {
    type MockResponse = { ok: true; json: () => Promise<unknown> }
    const pendingResponses: Array<(value: MockResponse) => void> = []
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    const unsupportedCoverage = {
      ...availableCoverage,
      discovery: { supported: false, coverage: 'unsupported', providerStatus: 'unsupported' },
    }
    let coverageAttempts = 0
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (input.toString().startsWith('/api/coverage')) {
        coverageAttempts += 1
        if (coverageAttempts === 1) {
          return Promise.resolve({ ok: true, json: async () => availableCoverage })
        }
        return new Promise<MockResponse>((resolve) => pendingResponses.push(resolve))
      }
      return Promise.resolve({ ok: true, json: async () => response })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute({ mockDiscovery: false })

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const currentDate = journeyDateBounds().min
    const nextDateValue = new Date(currentDate + 'T12:00:00Z')
    nextDateValue.setUTCDate(nextDateValue.getUTCDate() + 1)
    const nextDate = nextDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data plecării'), { target: { value: nextDate } })
    await waitFor(() => expect(pendingResponses).toHaveLength(1))

    const laterDateValue = new Date(nextDate + 'T12:00:00Z')
    laterDateValue.setUTCDate(laterDateValue.getUTCDate() + 1)
    const laterDate = laterDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data plecării'), { target: { value: laterDate } })
    await waitFor(() => expect(pendingResponses).toHaveLength(2))

    await act(async () => pendingResponses[1]({ ok: true, json: async () => availableCoverage }))
    const searchButton = screen.getByRole('button', { name: 'Arată destinațiile' })
    await waitFor(() => expect(searchButton).toBeEnabled())

    await act(async () => pendingResponses[0]({ ok: true, json: async () => unsupportedCoverage }))
    expect(searchButton).toBeEnabled()
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
    renderAppWithRoute()

    const routeDeparture = screen.getByRole('combobox', { name: 'De la' })
    await user.click(routeDeparture)
    await user.clear(routeDeparture)
    await user.type(routeDeparture, 'Brașov')
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
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
    const journeySourceLinks = screen.getAllByRole('link', {
      name: 'Verificat din sursa CFR Călători (se deschide într-o filă nouă)',
    })
    expect(journeySourceLinks).toHaveLength(3)
    expect(journeySourceLinks.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.cfrcalatori.ro/',
      'https://www.cfrcalatori.ro/',
      'https://www.cfrcalatori.ro/',
    ])
    expect(screen.getAllByText(/Date verificate:/)).toHaveLength(3)
    const otherReturns = screen.getByText('1 altă opțiune de întoarcere')
    const returnDisclosure = otherReturns.closest('details')
    expect(otherReturns).toBeVisible()
    expect(returnDisclosure?.open).toBe(false)
    expect(screen.getByText('IR 1630')).not.toBeVisible()
    await user.click(otherReturns)
    expect(returnDisclosure?.open).toBe(true)
    expect(screen.getByText('IR 1630')).toBeVisible()
    expect(screen.getByText('20:17')).toBeVisible()
    expect(screen.getAllByRole('link', {
      name: 'Verificat din sursa CFR Călători (se deschide într-o filă nouă)',
    })).toHaveLength(3)
    expect(screen.getAllByText(/Date verificate:/)).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Vezi ruta Brașov – Codlea' }))

    expect(screen.getByLabelText('De la')).toHaveValue('Brașov')
    expect(screen.getByLabelText('La')).toHaveValue('Codlea')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/trains?from=brasov&to=codlea'),
      expect.any(Object),
    )
  })

  it('clears stale destinations when criteria change and fetches only after resubmission', async () => {
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString()
      return {
        ok: true,
        json: async () => url.startsWith('/api/coverage')
          ? availableCoverage
          : url.startsWith('/api/destinations')
            ? destinationResponse
            : response,
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const searchButton = screen.getByRole('button', { name: 'Arată destinațiile' })
    await waitFor(() => expect(searchButton).toBeEnabled())
    await user.click(searchButton)
    expect(await screen.findByRole('heading', { name: 'Codlea' })).toBeVisible()
    expect(fetchMock.mock.calls.filter(([input]) => input.toString().startsWith('/api/destinations')))
      .toHaveLength(1)

    const nextDateValue = new Date(`${journeyDateBounds().min}T12:00:00Z`)
    nextDateValue.setUTCDate(nextDateValue.getUTCDate() + 1)
    const nextDate = nextDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data plecării'), { target: { value: nextDate } })

    await waitFor(() => expect(searchButton).toBeEnabled())
    expect(screen.queryByRole('heading', { name: 'Codlea' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([input]) => input.toString().startsWith('/api/destinations')))
      .toHaveLength(1)

    await user.click(searchButton)

    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) =>
      input.toString().startsWith('/api/destinations'))).toHaveLength(2))
    expect(String(fetchMock.mock.calls.filter(([input]) =>
      input.toString().startsWith('/api/destinations'))[1][0])).toContain(`date=${nextDate}`)
    expect(await screen.findByRole('heading', { name: 'Codlea' })).toBeVisible()
    expect(document.querySelector(`time[datetime="${nextDate}"]`)).toBeInTheDocument()
  })

  it('opens a specific route search from the empty destination state', async () => {
    const emptyDestinations: DestinationSearchResponse = {
      ...destinationResponse,
      options: [],
    }
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString()
      return {
        ok: true,
        json: async () => url.startsWith('/api/coverage')
          ? availableCoverage
          : url.startsWith('/api/destinations')
            ? emptyDestinations
            : response,
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const discoverButton = await screen.findByRole('button', { name: 'Arată destinațiile' })
    await waitFor(() => expect(discoverButton).toBeEnabled())
    await user.click(discoverButton)

    expect(await screen.findByRole('heading', {
      name: 'Nicio destinație directă cu bicicletă confirmată în zona pilot pentru această zi.',
    })).toBeVisible()
    const dateButton = screen.getByRole('button', { name: 'Alege o altă dată' })
    const requestCountBeforeDateFocus = fetchMock.mock.calls.length
    await user.click(dateButton)

    expect(screen.getByLabelText('Data plecării')).toHaveFocus()
    expect(fetchMock).toHaveBeenCalledTimes(requestCountBeforeDateFocus)

    const routeButton = screen.getByRole('button', { name: 'Caută o rută anume' })
    const requestCountBeforeSwitch = fetchMock.mock.calls.length
    await user.click(routeButton)

    expect(screen.getByRole('tab', { name: 'Caută o rută' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('De la')).toHaveValue('Codlea')
    expect(screen.getByLabelText('La')).toHaveValue('Brașov')
    expect(screen.getByLabelText('La')).toHaveFocus()
    expect(screen.getByLabelText('Data')).toHaveValue(journeyDateBounds().min)
    expect(fetchMock).toHaveBeenCalledTimes(requestCountBeforeSwitch)

    const arrivalStation = screen.getByLabelText('La')
    await user.clear(arrivalStation)
    await user.type(arrivalStation, 'Sibiu')
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Caută trenuri' }))

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining(`/api/trains?from=codlea&to=cfr-20658&date=${journeyDateBounds().min}`),
      expect.any(Object),
    ))
  })

  it('shows source-backed bicycle fares on destination journeys and leaves unsupported amounts unknown', async () => {
    const feeSource = 'Transportul bicicletelor și schiurilor CFR Călători'
    const feeUrl = 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/'
    const destinationWithFareEvidence: DestinationSearchResponse = {
      ...destinationResponse,
      options: [{
        ...destinationResponse.options[0],
        departures: [{
          ...destinationResponse.options[0].departures[0],
          bikeFeeLei: null,
          bikeFeeEvidence: {
            source: feeSource,
            sourceUrl: feeUrl,
            verifiedAt: '2026-10-15',
            bands: [
              { minDistanceKm: 1, maxDistanceKm: 60, feeLei: 8 },
              { minDistanceKm: 61, maxDistanceKm: 120, feeLei: 11.5 },
              { minDistanceKm: 121, maxDistanceKm: 250, feeLei: 17.5 },
              { minDistanceKm: 251, maxDistanceKm: 500, feeLei: 23.5 },
              { minDistanceKm: 501, maxDistanceKm: null, feeLei: 29 },
            ],
          },
        }],
        returns: [{
          ...destinationResponse.options[0].returns[0],
          bikeFeeLei: 8,
          bikeFeeEvidence: undefined,
        }],
      }],
    }
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = input.toString()
      return {
        ok: true,
        json: async () => url.startsWith('/api/coverage')
          ? availableCoverage
          : url.startsWith('/api/destinations')
            ? destinationWithFareEvidence
            : response,
      }
    }))
    const user = userEvent.setup()
    renderAppWithRoute()

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const searchButton = await screen.findByRole('button', { name: 'Arată destinațiile' })
    await user.click(searchButton)

    expect(await screen.findByText(
      'Supliment bicicletă: 8–29 lei (TVA inclus); suma exactă depinde de zona kilometrică și trebuie verificată la CFR',
    )).toBeVisible()
    expect(screen.getByText('Supliment bicicletă: de verificat')).toBeVisible()
    expect(screen.queryByText('Supliment bicicletă: 8 lei')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(feeSource) })).toHaveAttribute('href', feeUrl)
    expect(screen.getByText('Date verificate: 15 octombrie 2026')).toBeVisible()
  })

  it('switches search modes with arrow keys', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    const user = userEvent.setup()
    renderAppWithRoute()

    const routeTab = screen.getByRole('tab', { name: 'Caută o rută' })
    routeTab.focus()
    await user.keyboard('{ArrowRight}')

    const discoverTab = await screen.findByRole('tab', { name: 'Unde pot ajunge?' })
    expect(discoverTab).toHaveAttribute('aria-selected', 'true')
    expect(discoverTab).toHaveFocus()
  })

  it('carries the active route into discovery until discovery criteria are edited', async () => {
    const coverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => input.toString().startsWith('/api/coverage') ? coverage : response,
    })))
    const user = userEvent.setup()
    renderAppWithRoute()

    const firstDiscoveryDateValue = new Date(`${journeyDateBounds().min}T12:00:00Z`)
    firstDiscoveryDateValue.setUTCDate(firstDiscoveryDateValue.getUTCDate() + 1)
    const firstDiscoveryDate = firstDiscoveryDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: firstDiscoveryDate } })

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    expect(screen.getByLabelText('Plecare din')).toHaveValue('Codlea')
    expect(screen.getByLabelText('Data plecării')).toHaveValue(firstDiscoveryDate)

    const discoveryDeparture = screen.getByRole('combobox', { name: 'Plecare din' })
    await user.click(discoveryDeparture)
    await user.clear(discoveryDeparture)
    await user.type(discoveryDeparture, 'Brașov')
    await user.keyboard('{ArrowDown}{Enter}')
    const preservedDiscoveryDateValue = new Date(`${firstDiscoveryDate}T12:00:00Z`)
    preservedDiscoveryDateValue.setUTCDate(preservedDiscoveryDateValue.getUTCDate() + 1)
    const preservedDiscoveryDate = preservedDiscoveryDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data plecării'), {
      target: { value: preservedDiscoveryDate },
    })

    await user.click(screen.getByRole('tab', { name: 'Caută o rută' }))
    const laterRouteDateValue = new Date(`${preservedDiscoveryDate}T12:00:00Z`)
    laterRouteDateValue.setUTCDate(laterRouteDateValue.getUTCDate() + 1)
    const laterRouteDate = laterRouteDateValue.toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: laterRouteDate } })
    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))

    expect(screen.getByLabelText('Plecare din')).toHaveValue('Brașov')
    expect(screen.getByLabelText('Data plecării')).toHaveValue(preservedDiscoveryDate)
  })

  it('keeps each tab connected to its existing panel and hides the inactive panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))
    const user = userEvent.setup()
    renderAppWithRoute()

    const routeTab = screen.getByRole('tab', { name: 'Caută o rută' })
    const discoverTab = await screen.findByRole('tab', { name: 'Unde pot ajunge?' })
    const routePanel = document.getElementById(routeTab.getAttribute('aria-controls')!)
    const discoverPanel = document.getElementById(discoverTab.getAttribute('aria-controls')!)

    expect(routePanel).toHaveAttribute('role', 'tabpanel')
    expect(discoverPanel).toHaveAttribute('role', 'tabpanel')
    expect(routePanel).not.toHaveAttribute('hidden')
    expect(discoverPanel).toHaveAttribute('hidden')

    await user.click(discoverTab)

    expect(routePanel).toHaveAttribute('hidden')
    expect(discoverPanel).not.toHaveAttribute('hidden')
  })

  it('describes the regional pilot and provides a skip link', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))

    renderAppWithRoute()

    const skipLink = screen.getByRole('link', { name: 'Sari la conținut' })
    const main = screen.getByRole('main')
    expect(skipLink).toHaveAttribute('href', '#main')
    expect(main).toHaveAttribute('tabindex', '-1')
    await user.click(skipLink)
    expect(main).toHaveFocus()
    expect(screen.getByText('Pilot Transilvania centrală')).toBeVisible()
    expect(screen.getByText('Pilot regional · stații verificate')).toBeVisible()
    expect(await screen.findByText('Date verificate la')).toBeVisible()
    expect(await screen.findByText('3 sept. 2026, 14:20')).toBeVisible()
    expect(screen.getByText('Rezervarea locului pentru călător:')).toBeVisible()
    expect(screen.getByText(
      'Biletul pentru bicicletă este separat. CFR permite cumpărarea online doar dacă numărul biletelor pentru bicicletă este egal cu numărul călătorilor pentru care se cere rezervare și trenul oferă serviciul. La trenurile cu loc rezervat, locurile sunt lângă spațiul bicicletei.',
    )).toBeVisible()
    expect(screen.getByRole('link', { name: /Vezi pașii pentru cumpărarea online la CFR/ })).toHaveAttribute(
      'href',
      'https://www.cfrcalatori.ro/cum-cumpar-online/',
    )
    expect(screen.getByText('de verificat la operator')).toBeVisible()
    expect(screen.queryByText('Catalog național')).not.toBeInTheDocument()
  })

  it('stops searches and explains catalog expiry when the published station catalog expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-13T09:00:00+02:00'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderAppWithRoute()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Catalogul CFR verificat a expirat. Catalogul este valabil până la 12 decembrie 2026.',
    )
    expect(screen.getByLabelText('Data')).toBeDisabled()
    const routeSearchButton = screen.getByRole('button', { name: 'Caută trenuri' })
    expect(routeSearchButton).toBeDisabled()
    expect(routeSearchButton).toHaveAttribute('aria-describedby', 'journey-date-hint')
    expect(screen.queryByText(/Catalogul este valabil până la 12 decembrie 2026/, {
      selector: '.route-action-reason',
    })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('tab', { name: 'Unde pot ajunge?' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('disables searches when the catalog expires while the page remains open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-12T21:59:00Z'))
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    renderAppWithRoute()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const routeTab = screen.getByRole('tab', { name: 'Caută o rută' })
    const discoverTab = screen.getByRole('tab', { name: 'Unde pot ajunge?' })
    const routeDateInput = screen.getByLabelText('Data')
    expect(routeDateInput).not.toBeDisabled()
    fireEvent.click(discoverTab)

    const discoverDateInput = screen.getByLabelText('Data plecării')
    expect(discoverDateInput).not.toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })

    expect(screen.getByRole('heading', { name: 'Catalogul CFR verificat a expirat.' })).toBeVisible()
    expect(discoverDateInput).toBeDisabled()
    fireEvent.click(routeTab)
    expect(routeDateInput).toBeDisabled()
  })

  it('advances the editable and submitted search dates at Romanian midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T20:59:00Z'))
    const fetchMock = vi.fn((input: string | URL | Request) => {
      void input
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAppWithRoute()

    const routeDateInput = screen.getByLabelText('Data')
    expect(routeDateInput).toHaveValue('2026-10-14')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })

    expect(routeDateInput).toHaveValue('2026-10-15')
    expect(routeDateInput).toHaveAttribute('min', '2026-10-15')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('date=2026-10-15')

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Unde pot ajunge?' }))
    expect(screen.getByLabelText('Data plecării')).toHaveValue('2026-10-15')
  })

  it('refreshes an already submitted search when its date becomes past at Romanian midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T20:59:00Z'))
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAppWithRoute()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('date=2026-10-14')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('date=2026-10-15')
    expect(screen.getByText(/15 octombrie 2026/)).toBeVisible()
  })

  it('refreshes an already submitted destination search when its date becomes past at Romanian midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T20:59:00Z'))
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input.toString()
      const payload = url.startsWith('/api/coverage')
        ? availableCoverage
        : url.startsWith('/api/destinations') ? destinationResponse : response
      return Promise.resolve({ ok: true, json: async () => payload })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAppWithRoute()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Unde pot ajunge?' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Arată destinațiile' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const destinationRequests = () => fetchMock.mock.calls
      .map(([input]) => input.toString())
      .filter((url) => url.startsWith('/api/destinations'))
    expect(destinationRequests()).toHaveLength(1)
    expect(destinationRequests()[0]).toContain('date=2026-10-14')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(destinationRequests()).toHaveLength(2)
    expect(destinationRequests()[1]).toContain('date=2026-10-15')
    expect(screen.getByLabelText('Data plecării')).toHaveValue('2026-10-15')
  })

  it('keeps passenger seat reservation unknown when CFR only publishes a conditional rule', async () => {
    const policySource = 'Transportul bicicletelor și schiurilor CFR Călători — punctul 3'
    const policyUrl = 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/'
    const ticketPolicySource = 'Termeni CFR Călători online — bilet pentru bicicletă'
    const ticketPolicyUrl = 'https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: [{
          ...response.options[0],
          bikeReservation: 'unknown',
          bikeTicketPurchaseEvidence: {
            source: ticketPolicySource,
            sourceUrl: ticketPolicyUrl,
            verifiedAt: '2026-10-15',
          },
          bikeCapacityEvidence: {
            source: 'Transportul bicicletelor și schiurilor CFR Călători',
            sourceUrl: policyUrl,
            verifiedAt: '2026-10-15',
          },
          bikeReservationEvidence: {
            source: policySource,
            sourceUrl: policyUrl,
            verifiedAt: '2026-10-14',
          },
        }],
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByText('de verificat la operator')).toBeVisible()
    expect(screen.getByText('Rezervarea locului pentru călător:')).toBeVisible()
    expect(screen.getByText(
      'CFR admite o singură bicicletă nepliabilă de persoană, în limita locurilor disponibile. Nu știm câte locuri mai sunt pentru această cursă; verifică disponibilitatea și biletul pentru bicicletă la CFR.',
    )).toBeVisible()
    expect(screen.getByText(
      'Biletul pentru bicicletă este separat. CFR permite cumpărarea online doar dacă numărul biletelor pentru bicicletă este egal cu numărul călătorilor pentru care se cere rezervare și trenul oferă serviciul. La trenurile cu loc rezervat, locurile sunt lângă spațiul bicicletei.',
    )).toBeVisible()
    const capacityPolicyLinks = screen.getAllByRole('link', {
      name: /Transportul bicicletelor și schiurilor CFR Călători/,
    })
    expect(capacityPolicyLinks).toHaveLength(2)
    expect(capacityPolicyLinks[0]).toHaveAttribute('href', policyUrl)
    expect(screen.getByRole('link', { name: new RegExp(policySource) })).toHaveAttribute('href', policyUrl)
    expect(screen.getByRole('link', { name: new RegExp(ticketPolicySource) })).toHaveAttribute('href', ticketPolicyUrl)
    expect(screen.getByText('Date verificate: 14 octombrie 2026')).toBeVisible()
    expect(screen.getAllByText('Date verificate: 15 octombrie 2026')).toHaveLength(2)
  })

  it('explains that the CFR bicycle fee depends on distance and links to its current tariff source', async () => {
    const tariffSource = 'Întrebări frecvente CFR — tarife biciclete nepliabile'
    const tariffUrl = 'https://www.cfrcalatori.ro/intrebari-frecvente/'
    const scopeSource = 'Transportul bicicletelor și schiurilor CFR Călători'
    const scopeUrl = 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/'
    const scopeNote = 'Există o diferență între pagina dedicată CFR (Regio, Interregio și Intercity) și FAQ-ul CFR, care indică orice rang cu serviciu. Verifică tariful final la operator.'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: [{
          ...response.options[0],
          bikeFeeLei: null,
          bikeFeeEvidence: {
            source: tariffSource,
            sourceUrl: tariffUrl,
            verifiedAt: '2026-10-15',
            notes: [{
              text: scopeNote,
              source: scopeSource,
              sourceUrl: scopeUrl,
              verifiedAt: '2026-10-15',
            }],
            bands: [
              { minDistanceKm: 1, maxDistanceKm: 60, feeLei: 8 },
              { minDistanceKm: 61, maxDistanceKm: 120, feeLei: 11.5 },
              { minDistanceKm: 121, maxDistanceKm: 250, feeLei: 17.5 },
              { minDistanceKm: 251, maxDistanceKm: 500, feeLei: 23.5 },
              { minDistanceKm: 501, maxDistanceKm: null, feeLei: 29 },
            ],
          },
        }],
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByText(
      'Supliment bicicletă: 8–29 lei (TVA inclus); suma exactă depinde de zona kilometrică și trebuie verificată la CFR',
    )).toBeVisible()
    expect(screen.getByText(scopeNote)).toBeVisible()
    expect(screen.getByRole('link', { name: new RegExp(scopeSource) })).toHaveAttribute('href', scopeUrl)
    expect(screen.getByRole('link', { name: new RegExp(tariffSource) })).toHaveAttribute('href', tariffUrl)
    expect(screen.getAllByText('Date verificate: 15 octombrie 2026')).toHaveLength(2)
  })

  it('does not present a bicycle fee as confirmed without its own source evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))

    renderAppWithRoute()

    expect(await screen.findByText('Supliment bicicletă: de verificat')).toBeVisible()
    expect(screen.queryByText('Supliment bicicletă: 8 lei')).not.toBeInTheDocument()
  })

  it('uses the prefilled CFR planner link while keeping the source link as separate metadata', async () => {
    const bookingUrl = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries?DepartureStationName=Codlea'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: [{ ...response.options[0], bookingUrl }],
      }),
    }))

    renderAppWithRoute()

    const bikeSummary = await screen.findByRole('region', { name: 'Rezumat bicicletă și pasul următor' })
    expect(within(bikeSummary).getByText('Bicicletă acceptată')).toBeVisible()
    expect(within(bikeSummary).getByText('Locuri biciclete: disponibilitate necunoscută')).toBeVisible()
    expect(within(bikeSummary).getByText('Supliment bicicletă: de verificat')).toBeVisible()
    const bookingLink = within(bikeSummary).getByRole('link', { name: /Verifică disponibilitatea și cumpără pe CFR/ })
    expect(bookingLink).toHaveAttribute('href', bookingUrl)
    expect(bookingLink.compareDocumentPosition(
      within(bikeSummary).getByText(/Biletul pentru bicicletă este separat/),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('link', { name: /Verificat din sursa CFR Călători/ })).toHaveAttribute(
      'href',
      'https://www.cfrcalatori.ro/',
    )
  })

  it('shows the last verified time for a covered empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: [],
        meta: { ...response.meta, coverage: 'covered' },
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByRole('heading', {
      name: 'Nu am găsit o cursă directă cu transport pentru biciclete confirmat. Rutele cu schimbări nu sunt incluse în această căutare.',
    })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nu am găsit o cursă directă cu transport pentru biciclete confirmat. Rutele cu schimbări nu sunt incluse în această căutare. Sunt afișate date de rezervă verificate.',
    )
    expect(screen.getByText('Date verificate la')).toBeVisible()
    expect(screen.getByText('3 sept. 2026, 14:20')).toBeVisible()
  })

  it('labels cached official results as saved and not live', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        meta: {
          ...response.meta,
          providerId: 'cfr',
          reliability: 'official',
          cacheStatus: 'cached',
          coverage: 'covered',
          degraded: false,
        },
      }),
    }))

    renderAppWithRoute()

    const cachedStatus = await screen.findByText('Răspuns din cache, nu live')
    expect(cachedStatus).toBeVisible()
    expect(cachedStatus.closest('.data-state')).toHaveClass('cache-cached')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Răspunsul provine din cache; ora ultimei verificări este afișată.',
    )
    expect(screen.getByText('3 sept. 2026, 14:20')).toBeVisible()
  })

  it('announces when the result combines live and cached sources', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        meta: {
          ...response.meta,
          providerId: 'cfr',
          reliability: 'official',
          cacheStatus: 'mixed',
          coverage: 'covered',
          degraded: false,
        },
      }),
    }))

    renderAppWithRoute()

    const mixedStatus = await screen.findByText('Surse mixte: răspunsuri live și salvate')
    expect(mixedStatus).toBeVisible()
    expect(mixedStatus.closest('.data-state')).toHaveClass('cache-mixed')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Unele surse au răspuns din cache, altele live; ora ultimei verificări este afișată.',
    )
  })

  it('does not call partial live data cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        meta: {
          ...response.meta,
          providerId: 'cfr',
          reliability: 'official',
          cacheStatus: 'live',
          coverage: 'covered',
          degraded: true,
          partial: true,
          warning: 'O sursă suplimentară este temporar indisponibilă.',
        },
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByText('Sursă oficială')).toBeVisible()
    expect(screen.queryByText('Răspuns din cache, nu live')).not.toBeInTheDocument()
    expect(screen.getByText('O sursă suplimentară este temporar indisponibilă.')).toBeVisible()
  })

  it('links the queried source when an authoritative result is empty', async () => {
    const sourceUrl = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: [],
        meta: {
          ...response.meta,
          providerId: 'cfr',
          reliability: 'official',
          coverage: 'covered',
          sources: [{
            providerId: 'cfr',
            outcome: 'success',
            fetchedAt: response.meta.asOf,
            warning: null,
            sourceInfo: { name: 'CFR Călători', url: sourceUrl },
          }],
        },
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByRole('link', { name: /CFR Călători/ })).toHaveAttribute(
      'href',
      sourceUrl,
    )
  })

  it('keeps the observation time visible without claiming an unknown source reliability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        options: [],
        meta: { ...response.meta, coverage: 'covered', reliability: null },
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByText('Date verificate la')).toBeVisible()
    expect(screen.getByText('3 sept. 2026, 14:20')).toBeVisible()
    expect(screen.queryByText('Date ufficiale actuale')).not.toBeInTheDocument()
  })

  it('announces the guidance when no compatible direct destinations are found', async () => {
    const emptyDestinations: DestinationSearchResponse = {
      ...destinationResponse,
      options: [],
      meta: { ...destinationResponse.meta, coverage: 'covered' },
    }
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const payload = input.toString().startsWith('/api/destinations')
        ? emptyDestinations
        : response
      return Promise.resolve({ ok: true, json: async () => payload })
    }))

    const user = userEvent.setup()
    renderAppWithRoute()

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const searchButton = await screen.findByRole('button', { name: 'Arată destinațiile' })
    await user.click(searchButton)

    expect(await screen.findByRole('heading', {
      name: 'Nicio destinație directă cu bicicletă confirmată în zona pilot pentru această zi.',
    })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nicio destinație directă cu bicicletă confirmată în zona pilot pentru această zi. Poți încerca o altă dată sau căuta o rută anume în prima modalitate. Sunt afișate date de rezervă verificate.',
    )
  })

  it('offers a retry when destination coverage becomes temporarily unavailable', async () => {
    const unavailableDestinations = {
      ...destinationResponse,
      options: [],
      meta: {
        ...destinationResponse.meta,
        providerId: 'cfr',
        coverage: 'unavailable',
        providerStatus: 'unavailable',
        asOf: null,
        partial: false,
        degraded: true,
      },
    }
    let destinationAttempts = 0
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input.toString()
      const payload = url.startsWith('/api/destinations')
        ? (++destinationAttempts === 1 ? unavailableDestinations : destinationResponse)
        : response
      return Promise.resolve({ ok: true, json: async () => payload })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const searchButton = await screen.findByRole('button', { name: 'Arată destinațiile' })
    await vi.waitFor(() => expect(searchButton).toBeEnabled())
    await user.click(searchButton)

    expect(await screen.findByRole('heading', {
      name: 'Datele CFR sunt temporar indisponibile.',
    })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Încearcă din nou' }))

    expect(await screen.findByRole('heading', { name: 'Codlea' })).toBeVisible()
    expect(destinationAttempts).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
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
          warning: 'Traseul solicitat nu este acoperit de pilotul curent.',
          asOf: null,
          partial: false,
          degraded: true,
          sources: [],
        },
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByRole('heading', { name: 'Ruta nu este încă acoperită de pilot.' })).toBeVisible()
    expect(screen.queryByText('Traseul solicitat nu este acoperit de pilotul curent.')).not.toBeInTheDocument()
    expect(screen.queryByText(
      'Nu am găsit o cursă directă cu transport pentru biciclete confirmat. Rutele cu schimbări nu sunt incluse în această căutare.',
    )).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vezi ziua următoare' })).not.toBeInTheDocument()
  })

  it('does not show an outage warning for unsupported destination discovery', async () => {
    const unsupportedWarning = 'Explorarea destinațiilor nu este disponibilă în pilotul curent.'
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
            ? {
                ...destinationResponse,
                options: [],
                meta: {
                  ...destinationResponse.meta,
                  providerId: 'none',
                  coverage: 'unsupported',
                  warning: unsupportedWarning,
                  asOf: null,
                  partial: false,
                  degraded: true,
                },
              }
            : response,
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute()

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const searchButton = screen.getByRole('button', { name: 'Arată destinațiile' })
    await waitFor(() => expect(searchButton).toBeEnabled())
    await user.click(searchButton)

    expect(await screen.findByRole('heading', {
      name: 'Explorarea nu este disponibilă în acest pilot.',
    })).toBeVisible()
    expect(screen.queryByText(unsupportedWarning)).not.toBeInTheDocument()
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
          providerStatus: 'unavailable',
          asOf: null,
          partial: false,
          degraded: true,
          sources: [{
            providerId: 'cfr',
            sourceInfo: {
              name: 'CFR Călători',
              url: 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
            },
            searchUrl: 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries?DepartureStationName=Codlea&ArrivalStationName=Bra%C8%99ov&DepartureDate=15.10.2026&IsBikesServiceRequired=True',
            outcome: 'unavailable', fetchedAt: null, warning: null,
          }],
        },
      }),
    }))

    renderAppWithRoute()

    expect(await screen.findByRole('heading', { name: 'Datele CFR sunt temporar indisponibile.' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible()
    expect(screen.getByRole('link', {
      name: 'Verifică la CFR Călători (se deschide într-o filă nouă)',
    })).toHaveAttribute(
      'href',
      'https://bilete.cfrcalatori.ro/ro-RO/Itineraries?DepartureStationName=Codlea&ArrivalStationName=Bra%C8%99ov&DepartureDate=15.10.2026&IsBikesServiceRequired=True',
    )
  })

  it('explains when live search is disabled and does not offer a futile retry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'))
    const sourceUrl = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'
    const initialSearchUrl = `${sourceUrl}?DepartureStationName=Codlea&ArrivalStationName=Bra%C8%99ov&DepartureDate=15.10.2026&IsBikesServiceRequired=True`
    const dateSearchUrl = `${sourceUrl}?DepartureStationName=Codlea&ArrivalStationName=Bra%C8%99ov&DepartureDate=16.10.2026&IsBikesServiceRequired=True`
    const swappedSearchUrl = `${sourceUrl}?DepartureStationName=Bra%C8%99ov&ArrivalStationName=Codlea&DepartureDate=16.10.2026&IsBikesServiceRequired=True`
    const disabledResponse = (searchUrl: string): TrainSearchResponse => ({
      options: [],
      meta: {
        ...response.meta,
        providerId: 'pilot',
        reliability: null,
        coverage: 'unavailable',
        providerStatus: 'disabled',
        asOf: null,
        warning: null,
        degraded: true,
        sources: [{
          providerId: 'cfr',
          sourceInfo: { name: 'CFR Călători', url: sourceUrl },
          searchUrl,
          outcome: 'unavailable',
          fetchedAt: null,
          warning: null,
        }],
      },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => disabledResponse(initialSearchUrl) })
      .mockResolvedValueOnce({ ok: true, json: async () => disabledResponse(dateSearchUrl) })
      .mockResolvedValueOnce({ ok: true, json: async () => disabledResponse(swappedSearchUrl) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    renderAppWithRoute()

    expect(await screen.findByRole('heading', {
      name: 'Căutarea live CFR nu este activată.',
    })).toBeVisible()
    expect(screen.getByRole('link', {
      name: 'Verifică la CFR Călători (se deschide într-o filă nouă)',
    })).toHaveAttribute(
      'href',
      'https://bilete.cfrcalatori.ro/ro-RO/Itineraries?DepartureStationName=Codlea&ArrivalStationName=Bra%C8%99ov&DepartureDate=15.10.2026&IsBikesServiceRequired=True',
    )
    expect(screen.getAllByText(
      'Nu putem verifica trenurile pe acest serviciu cât timp sursa live este dezactivată. Nu afișăm orare neverificate.',
    )).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Căutarea live CFR nu este activată.')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Linkul de verificare la operator este pregătit pentru Codlea → Brașov, în data de 15 octombrie 2026.',
    )
    const searchButton = screen.getByRole('button', { name: 'Pregătește linkul pentru verificare' })
    expect(searchButton).toBeEnabled()
    expect(searchButton).toHaveAttribute(
      'aria-describedby',
      'journey-date-hint route-action-reason',
    )
    expect(screen.getByText(
      'Nu putem verifica trenurile pe acest serviciu cât timp sursa live este dezactivată. Nu afișăm orare neverificate.',
      { selector: '.route-action-reason' },
    )).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Încearcă din nou' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-16' } })
    await user.click(searchButton)
    await waitFor(() => expect(screen.getByRole('link', {
      name: 'Verifică la CFR Călători (se deschide într-o filă nouă)',
    })).toHaveAttribute('href', dateSearchUrl))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Linkul de verificare la operator este pregătit pentru Codlea → Brașov, în data de 16 octombrie 2026.',
    )
    const dateSearch = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost').searchParams
    expect(dateSearch.get('from')).toBe('codlea')
    expect(dateSearch.get('to')).toBe('brasov')
    expect(dateSearch.get('date')).toBe('2026-10-16')

    await user.click(screen.getByRole('button', { name: 'Inversează direcția' }))
    await waitFor(() => expect(screen.getByRole('link', {
      name: 'Verifică la CFR Călători (se deschide într-o filă nouă)',
    })).toHaveAttribute('href', swappedSearchUrl))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Linkul de verificare la operator este pregătit pentru Brașov → Codlea, în data de 16 octombrie 2026.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const swappedSearch = new URL(String(fetchMock.mock.calls[2][0]), 'http://localhost').searchParams
    expect(swappedSearch.get('from')).toBe('brasov')
    expect(swappedSearch.get('to')).toBe('codlea')
    expect(swappedSearch.get('date')).toBe('2026-10-16')
  })

  it('attributes the station catalog source, license, and validity dates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }))

    renderAppWithRoute()

    expect(screen.getByRole('link', { name: 'Mersul trenurilor CFR 2025–2026' }))
      .toHaveAttribute('href', 'https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2')
    expect(screen.getByRole('link', { name: 'OGL-ROU-1.0' }))
      .toHaveAttribute('href', 'https://data.gov.ro/ro/pages/licence')
    expect(screen.getByText(/exportat la 3 decembrie 2025/)).toBeVisible()
    expect(document.querySelector('.catalog-attribution'))
      .toHaveTextContent(/valabil până la 12 decembrie 2026/)
  })

  it('does not offer destination search when discovery is unsupported', async () => {
    let finishCoverage: ((value: { ok: true; json: () => Promise<unknown> }) => void) | undefined
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => response })
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishCoverage = resolve
      }))
    vi.stubGlobal('fetch', fetchMock)
    renderAppWithRoute({ mockDiscovery: false })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('tab', { name: 'Unde pot ajunge?' })).not.toBeInTheDocument()
    await act(async () => finishCoverage?.({
      ok: true,
      json: async () => ({
        pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
        route: { supported: true, coverage: 'available', providerStatus: 'ready' },
        discovery: { supported: false, coverage: 'unsupported', providerStatus: 'unsupported' },
      }),
    }))

    expect(screen.queryByRole('tab', { name: 'Unde pot ajunge?' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => input.toString().startsWith('/api/destinations'))).toBe(false)
  })

  it('returns focus to the route tab when discovery becomes unsupported', async () => {
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    const unsupportedCoverage = {
      ...availableCoverage,
      discovery: { supported: false, coverage: 'unsupported', providerStatus: 'unsupported' },
    }
    let coverageAttempts = 0
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input.toString()
      if (url.startsWith('/api/coverage')) {
        const payload = coverageAttempts++ === 0 ? availableCoverage : unsupportedCoverage
        return Promise.resolve({ ok: true, json: async () => payload })
      }
      return Promise.resolve({ ok: true, json: async () => response })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute({ mockDiscovery: false })

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))
    const departure = screen.getByRole('combobox', { name: 'Plecare din' })
    await user.clear(departure)
    await user.type(departure, 'Sibiu')
    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: 'Unde pot ajunge?' })).not.toBeInTheDocument()
    })
    const routeTab = screen.getByRole('tab', { name: 'Caută o rută' })
    expect(routeTab).toHaveAttribute('aria-selected', 'true')
    expect(routeTab).toHaveFocus()
    expect(fetchMock.mock.calls.some(([input]) => input.toString().startsWith('/api/destinations'))).toBe(false)
  })

  it('retries an unavailable discovery check before showing destination results', async () => {
    const availableCoverage = {
      pilot: { region: 'Brașov, Sibiu, Covasna și Mureș', mappingComplete: true, source: 'environment' },
      route: { supported: true, coverage: 'available', providerStatus: 'ready' },
      discovery: { supported: true, coverage: 'available', providerStatus: 'ready' },
    }
    let coverageAttempts = 0
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input.toString()
      if (url.startsWith('/api/coverage') && ++coverageAttempts < 2) {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      const payload = url.startsWith('/api/coverage')
        ? availableCoverage
        : url.startsWith('/api/destinations') ? destinationResponse : response
      return Promise.resolve({ ok: true, json: async () => payload })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAppWithRoute({ mockDiscovery: false })

    await user.click(await screen.findByRole('tab', { name: 'Unde pot ajunge?' }))

    expect(await screen.findByRole('heading', {
      name: 'Datele CFR sunt temporar indisponibile.',
    })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Încearcă din nou' }))

    expect(await screen.findByRole('heading', { name: 'Începe cu gara de plecare.' })).toBeVisible()
    const searchButton = screen.getByRole('button', { name: 'Arată destinațiile' })
    expect(searchButton).toBeEnabled()
    await user.click(searchButton)

    expect(await screen.findByRole('heading', { name: 'Codlea' })).toBeVisible()
    expect(coverageAttempts).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
