import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncGutter } from './SyncGutter'

describe('SyncGutter', () => {
  it('describes each state for assistive tech', () => {
    const { rerender } = render(<SyncGutter state="local" />)
    expect(screen.getByRole('img', { name: /sin sincronizar/i })).toBeInTheDocument()

    rerender(<SyncGutter state="queued" />)
    expect(screen.getByRole('img', { name: /en cola/i })).toBeInTheDocument()

    rerender(<SyncGutter state="synced" />)
    expect(screen.getByRole('img', { name: /sincronizado/i })).toBeInTheDocument()

    rerender(<SyncGutter state="failed" />)
    expect(screen.getByRole('img', { name: /rechazado/i })).toBeInTheDocument()
  })
})
