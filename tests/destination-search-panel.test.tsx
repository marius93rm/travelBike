import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { journeyDateBounds } from '../src/domain/journey-date.js'
import { DestinationSearchPanel } from '../src/app/components/DestinationSearchPanel.js'

describe('DestinationSearchPanel', () => {
  it('does not run a search when the panel is disabled', () => {
    const onSearch = vi.fn()
    const formCriteria = {
      from: 'brasov' as const,
      date: journeyDateBounds().min,
      bike: true as const,
      direct: true as const,
    }

    render(
      <DestinationSearchPanel
        criteria={formCriteria}
        loading={false}
        disabled
        onChange={vi.fn()}
        onSearch={onSearch}
      />,
    )

    const form = screen.getByRole('button', { name: 'Arată destinațiile' }).closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)

    expect(onSearch).not.toHaveBeenCalled()
  })

  it('does not submit destination discovery through the form while loading', () => {
    const onSearch = vi.fn()

    render(
      <DestinationSearchPanel
        criteria={{
          from: 'brasov',
          date: journeyDateBounds().min,
          bike: true,
          direct: true,
        }}
        loading
        onChange={vi.fn()}
        onSearch={onSearch}
      />,
    )

    const form = screen.getByRole('button', { name: 'Arată destinațiile' }).closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)

    expect(onSearch).not.toHaveBeenCalled()
  })
})
