import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RequireRole } from './RequireRole'

const useAuthMock = vi.fn()

vi.mock('./AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AuthContext')>()
  return { ...actual, useAuth: () => useAuthMock() }
})

function renderProtected() {
  render(
    <MemoryRouter initialEntries={['/protegida']}>
      <Routes>
        <Route
          path="/protegida"
          element={
            <RequireRole roles={['COMPANY']}>
              <p>Contenido protegido</p>
            </RequireRole>
          }
        />
        <Route path="/login" element={<p>Página de login</p>} />
        <Route path="/" element={<p>Inicio</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireRole', () => {
  it('redirects to /login when there is no authenticated user', () => {
    useAuthMock.mockReturnValue({ user: null, role: null })
    renderProtected()
    expect(screen.getByText('Página de login')).toBeInTheDocument()
  })

  it('redirects to / when the user role is not allowed', () => {
    useAuthMock.mockReturnValue({ user: { id: 1, role: 'STUDENT' }, role: 'STUDENT' })
    renderProtected()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })

  it('renders the children when the role is allowed', () => {
    useAuthMock.mockReturnValue({ user: { id: 1, role: 'COMPANY' }, role: 'COMPANY' })
    renderProtected()
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
  })
})
