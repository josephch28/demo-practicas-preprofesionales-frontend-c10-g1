import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApplicationRanking } from '@/api/companies'
import { AI_DISCLAIMER, AffinityNote, ApplicationRankingBar } from './ApplicationRankingBar'

const RANKING: ApplicationRanking = { offerId: 7, ranking: [], unranked: [], truncated: false }

function setup(overrides: Partial<Parameters<typeof ApplicationRankingBar>[0]> = {}) {
  const props = {
    pendingCount: 3,
    online: true,
    loading: false,
    ranking: null,
    error: null,
    onSuggest: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  }
  render(<ApplicationRankingBar {...props} />)
  return props
}

describe('ApplicationRankingBar (IA-02)', () => {
  it('con 2 o más pendientes ofrece sugerir y llama a onSuggest', () => {
    const props = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Sugerir mejores postulantes' }))

    expect(props.onSuggest).toHaveBeenCalledTimes(1)
  })

  it('con menos de 2 pendientes no muestra nada', () => {
    setup({ pendingCount: 1 })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('mientras analiza deshabilita el botón', () => {
    setup({ loading: true })

    expect(screen.getByRole('button', { name: 'Analizando…' })).toBeDisabled()
  })

  it('sin conexión deshabilita el botón y explica por qué', () => {
    setup({ online: false })

    expect(screen.getByRole('button', { name: 'Sugerir mejores postulantes' })).toBeDisabled()
    expect(screen.getByText('La sugerencia necesita conexión a internet.')).toBeInTheDocument()
  })

  it('con sugerencia muestra el aviso de que la decisión es de la empresa y permite quitarla', () => {
    const props = setup({ ranking: RANKING })

    expect(screen.getByText(AI_DISCLAIMER)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar sugerencia' }))
    expect(props.onClear).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando solo se evaluaron las 50 más recientes', () => {
    setup({ ranking: { ...RANKING, truncated: true } })

    expect(screen.getByText('Se evaluaron las 50 postulaciones más recientes.')).toBeInTheDocument()
  })

  it('muestra el error como alerta', () => {
    setup({ error: 'La función de IA no está disponible.' })

    expect(screen.getByRole('alert')).toHaveTextContent('La función de IA no está disponible.')
  })

  it('con una sugerencia activa sigue mostrándola aunque queden menos de 2 pendientes', () => {
    setup({ pendingCount: 1, ranking: RANKING })

    expect(screen.getByRole('button', { name: 'Quitar sugerencia' })).toBeInTheDocument()
  })
})

describe('AffinityNote (IA-02)', () => {
  it('muestra la afinidad y el motivo', () => {
    render(<AffinityNote suggestion={{ applicationId: 1, score: 86, reason: 'Tiene experiencia en soporte.' }} />)

    expect(screen.getByText('Afinidad 86/100')).toBeInTheDocument()
    expect(screen.getByText('Tiene experiencia en soporte.')).toBeInTheDocument()
  })

  it('no deja un hueco si el motivo viene vacío', () => {
    render(<AffinityNote suggestion={{ applicationId: 1, score: 10, reason: '' }} />)

    expect(screen.getByText('Afinidad 10/100')).toBeInTheDocument()
  })
})
