import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DestinationSearchPanel } from '../src/app/components/DestinationSearchPanel.js'
import { SearchModeTabs } from '../src/app/components/SearchModeTabs.js'
import { SearchPanel } from '../src/app/components/SearchPanel.js'
import { StationCombobox } from '../src/app/components/StationCombobox.js'

describe('search accessibility', () => {
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

  it('focuses the first invalid route station and announces its error', async () => {
    const user = userEvent.setup()
    render(
      <SearchPanel
        criteria={{ from: 'codlea', to: 'brasov', date: '2026-09-05', bike: true }}
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

  it('focuses the invalid discovery station', async () => {
    const user = userEvent.setup()
    render(
      <DestinationSearchPanel
        criteria={{ from: 'brasov', date: '2026-09-05', bike: true, direct: true }}
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
