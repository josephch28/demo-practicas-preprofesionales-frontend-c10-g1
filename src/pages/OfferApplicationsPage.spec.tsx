import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import type { OfferApplication } from '@/api/companies'
import { OfferApplicationsPage } from './OfferApplicationsPage'

const { listMock, rankMock, decideMock, getOfferMock, onlineMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  rankMock: vi.fn(),
  decideMock: vi.fn(),
  getOfferMock: vi.fn(),
  onlineMock: vi.fn(),
}))

vi.mock('@/api/companies', () => ({
  listApplicationsForOffer: (...args: unknown[]) => listMock(...args),
  rankApplicationsForOffer: (...args: unknown[]) => rankMock(...args),
  decideApplication: (...args: unknown[]) => decideMock(...args),
}))
vi.mock('@/api/offers', () => ({ getOffer: (...args: unknown[]) => getOfferMock(...args) }))
vi.mock('@/offline/hooks/useOnline', () => ({ useOnline: () => onlineMock() }))

function app(id: number, overrides: Partial<OfferApplication> = {}): OfferApplication {
  return {
    id,
    offerId: 7,
    studentId: id,
    status: 'SUBMITTED',
    motivation: `motivo ${id}`,
    submittedAt: '2026-10-20T10:00:00.000Z',
    decidedAt: null,
    student: { id, fullName: `Estudiante ${id}`, email: `e${id}@x.com` },
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/ofertas-empresa/7/postulaciones']}>
      <Routes>
        <Route path="/ofertas-empresa/:id/postulaciones" element={<OfferApplicationsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const names = () => screen.getAllByText(/^Estudiante \d$/).map((node) => node.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  onlineMock.mockReturnValue(true)
  getOfferMock.mockResolvedValue({ id: 7, title: 'Soporte TI', seats: 2 })
  listMock.mockResolvedValue([app(1), app(2), app(3)])
})

describe('OfferApplicationsPage · sugerir mejores postulantes (IA-02)', () => {
  it('ordena por afinidad con insignia y motivo, y avisa que la decisión es de la empresa', async () => {
    rankMock.mockResolvedValue({
      offerId: 7,
      ranking: [
        { applicationId: 2, score: 91, reason: 'Experiencia en soporte.' },
        { applicationId: 3, score: 35, reason: 'Poca relación con la oferta.' },
      ],
      unranked: [1],
      truncated: false,
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir mejores postulantes' }))

    await screen.findByText('Afinidad 91/100')
    expect(rankMock).toHaveBeenCalledWith(7)
    expect(names()).toEqual(['Estudiante 2', 'Estudiante 3', 'Estudiante 1'])
    expect(screen.getByText('Experiencia en soporte.')).toBeInTheDocument()
    expect(screen.getByText(/La decisión es tuya/)).toBeInTheDocument()
    // La lista sigue completa y las acciones intactas.
    expect(screen.getAllByRole('button', { name: 'Aceptar' })).toHaveLength(3)
  })

  it('"Quitar sugerencia" devuelve el orden original sin insignias', async () => {
    rankMock.mockResolvedValue({ offerId: 7, ranking: [{ applicationId: 3, score: 80, reason: 'ok' }], unranked: [1, 2], truncated: false })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir mejores postulantes' }))
    await screen.findByText('Afinidad 80/100')

    fireEvent.click(screen.getByRole('button', { name: 'Quitar sugerencia' }))

    expect(names()).toEqual(['Estudiante 1', 'Estudiante 2', 'Estudiante 3'])
    expect(screen.queryByText('Afinidad 80/100')).not.toBeInTheDocument()
  })

  it.each([
    [new ApiError(503, 'x'), 'La función de IA no está disponible.'],
    [new ApiError(429, 'x'), 'Espera un momento antes de volver a intentar.'],
    [new ApiError(502, 'x'), 'No se pudo obtener la sugerencia, intenta de nuevo.'],
  ])('si falla (%s) muestra el mensaje y deja la lista intacta', async (error, message) => {
    rankMock.mockRejectedValue(error)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir mejores postulantes' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
    expect(names()).toEqual(['Estudiante 1', 'Estudiante 2', 'Estudiante 3'])
    expect(screen.getByRole('button', { name: 'Sugerir mejores postulantes' })).toBeEnabled()
  })

  it('sin conexión el botón está deshabilitado', async () => {
    onlineMock.mockReturnValue(false)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Sugerir mejores postulantes' })).toBeDisabled()
  })

  it('no ofrece sugerir cuando hay menos de 2 postulaciones pendientes', async () => {
    listMock.mockResolvedValue([app(1), app(2, { status: 'REJECTED' })])
    renderPage()

    await screen.findByText('Estudiante 1')
    expect(screen.queryByRole('button', { name: 'Sugerir mejores postulantes' })).not.toBeInTheDocument()
  })

  it('no muestra afinidad en postulaciones que ya no se pueden decidir', async () => {
    listMock.mockResolvedValue([app(1), app(2), app(3, { status: 'ACCEPTED' })])
    rankMock.mockResolvedValue({ offerId: 7, ranking: [{ applicationId: 3, score: 99, reason: 'ya aceptada' }], unranked: [1, 2], truncated: false })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir mejores postulantes' }))

    await waitFor(() => expect(screen.getByText(/La decisión es tuya/)).toBeInTheDocument())
    expect(screen.queryByText('Afinidad 99/100')).not.toBeInTheDocument()
  })

  it('pedir la sugerencia no cambia el estado de ninguna postulación', async () => {
    rankMock.mockResolvedValue({ offerId: 7, ranking: [], unranked: [1, 2, 3], truncated: false })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir mejores postulantes' }))
    await waitFor(() => expect(rankMock).toHaveBeenCalled())

    expect(decideMock).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Aceptar' })).toHaveLength(3)
  })
})
