import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('maps a status from each group to its tone class', () => {
    const { rerender } = render(<StatusBadge status="APPROVED" />)
    expect(screen.getByText('APPROVED').className).toContain('text-stamp')

    rerender(<StatusBadge status="SUBMITTED" />)
    expect(screen.getByText('SUBMITTED').className).toContain('text-pending')

    rerender(<StatusBadge status="REJECTED" />)
    expect(screen.getByText('REJECTED').className).toContain('text-void')

    rerender(<StatusBadge status="WHATEVER" />)
    expect(screen.getByText('WHATEVER').className).toContain('text-inkSoft')
  })
})
