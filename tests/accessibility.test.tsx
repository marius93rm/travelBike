import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { journeyDateBounds } from '../src/domain/journey-date.js'
import { DestinationSearchPanel } from '../src/app/components/DestinationSearchPanel.js'
import { SearchModeTabs } from '../src/app/components/SearchModeTabs.js'
import { SearchPanel } from '../src/app/components/SearchPanel.js'
import { StationCombobox } from '../src/app/components/StationCombobox.js'

describe('search accessibility', () => {
  const validJourneyDate = journeyDateBounds().min

  it('keeps combobox status outside its listbox and only controls an open listbox', async () => {
    const user = userEvent.setup()
    render(
      <StationCombobox
        id="station"
        label="Stație"
        stationId="brasov"
        invalid={false}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox', { name: 'Stație' })
    expect(input).not.toHaveAttribute('aria-controls')

    await user.click(input)

    const listbox = screen.getByRole('listbox')
    const status = screen.getByRole('status')
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(listbox).not.toContainElement(status)
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option')).not.toContainEqual(expect.any(HTMLButtonElement))
  })

  it('closes the suggestions immediately when Tab leaves the combobox', async () => {
    const user = userEvent.setup()
    render(
      <StationCombobox
        id="station"
        label="Stație"
        stationId="brasov"
        invalid={false}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox', { name: 'Stație' })
    await user.click(input)
    expect(screen.getByRole('listbox')).toBeVisible()

    await user.tab()

    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-controls')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps no-match guidance outside the listbox and removes its stale control reference', async () => {
    const user = userEvent.setup()
    render(
      <StationCombobox
        id="station"
        label="Stație"
        stationId="brasov"
        invalid={false}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox', { name: 'Stație' })
    await user.clear(input)
    await user.type(input, 'xyz-nu-exista')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Nicio stație găsită. Verifică numele introdus.',
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByText('Nicio stație găsită. Verifică numele introdus.', {
        selector: 'p.station-no-results',
      }),
    ).toBeVisible()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-controls')
  })

  it('scrolls the active combobox option into view', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const user = userEvent.setup()
    render(
      <StationCombobox
        id="station"
        label="Stație"
        stationId="brasov"
        invalid={false}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Stație' }))
    await user.keyboard('{ArrowDown}')

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('selects a station from the suggestions with the keyboard', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <StationCombobox
        id="station"
        label="Stație"
        stationId="brasov"
        invalid={false}
        onChange={onChange}
        onValidityChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox', { name: 'Stație' })
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Codlea')

    const option = screen.getByRole('option', { name: 'Codlea, Stație CFR' })
    expect(input).not.toHaveAttribute('aria-activedescendant')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', option.id)
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('codlea')
    expect(input).toHaveValue('Codlea')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('focuses the first invalid route station and announces its error', async () => {
    const user = userEvent.setup()
    render(
      <SearchPanel
        criteria={{ from: 'codlea', to: 'brasov', date: validJourneyDate, bike: true }}
        loading={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        onSwap={vi.fn()}
      />,
    )

    const from = screen.getByRole('combobox', { name: 'De la' })
    await user.clear(from)
    await user.type(from, 'Nu există')
    await user.click(screen.getByRole('button', { name: 'Caută trenuri' }))

    expect(from).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('Selectează o stație din lista de sugestii.')
  })

  it('does not submit the route search through the form while loading', () => {
    const onSearch = vi.fn()
    render(
      <SearchPanel
        criteria={{ from: 'codlea', to: 'brasov', date: validJourneyDate, bike: true }}
        loading
        onChange={vi.fn()}
        onSearch={onSearch}
        onSwap={vi.fn()}
      />,
    )

    const form = screen.getByRole('button', { name: 'Caută trenuri' }).closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)

    expect(onSearch).not.toHaveBeenCalled()
  })

  it('focuses the invalid discovery station', async () => {
    const user = userEvent.setup()
    render(
      <DestinationSearchPanel
        criteria={{ from: 'brasov', date: validJourneyDate, bike: true, direct: true }}
        loading={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )

    const from = screen.getByRole('combobox', { name: 'Plecare din' })
    await user.clear(from)
    await user.type(from, 'Nu există')
    await user.click(screen.getByRole('button', { name: 'Arată destinațiile' }))

    expect(from).toHaveFocus()
  })

  it('describes the maximum searchable date in both search modes', () => {
    const criteria = {
      from: 'codlea' as const,
      to: 'brasov' as const,
      date: validJourneyDate,
      bike: true as const,
    }
    const { rerender } = render(
      <SearchPanel
        criteria={criteria}
        loading={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        onSwap={vi.fn()}
      />,
    )

    const routeDate = screen.getByLabelText('Data')
    expect(routeDate).toHaveAttribute('aria-describedby', 'journey-date-hint')
    const routeDateHint = screen.getByText(/^Data maximă pentru căutare:/)
    expect(routeDateHint).toBeVisible()
    expect(routeDateHint).toHaveTextContent(
      'Fereastra curentă: până la 30 de zile calendaristice, inclusiv azi.',
    )

    rerender(
      <DestinationSearchPanel
        criteria={{ from: 'brasov', date: validJourneyDate, bike: true, direct: true }}
        loading={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )

    const discoveryDate = screen.getByLabelText('Data plecării')
    expect(discoveryDate).toHaveAttribute('aria-describedby', 'discover-date-hint')
    const discoveryDateHint = screen.getByText(/^Data maximă pentru căutare:/)
    expect(discoveryDateHint).toBeVisible()
    expect(discoveryDateHint).toHaveTextContent(
      'Fereastra curentă: până la 30 de zile calendaristice, inclusiv azi.',
    )
  })

  it('supports Home and End for the search mode tabs', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<SearchModeTabs activeMode="discover" onChange={onChange} />)

    const discover = screen.getByRole('tab', { name: 'Unde pot ajunge?' })
    discover.focus()
    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('route')

    rerender(<SearchModeTabs activeMode="route" onChange={onChange} />)
    const route = screen.getByRole('tab', { name: 'Caută o rută' })
    route.focus()
    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('discover')
  })
})
