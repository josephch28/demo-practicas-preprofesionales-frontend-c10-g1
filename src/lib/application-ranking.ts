import { ApiError } from '@/api/client'
import type { ApplicationRanking, ApplicationSuggestion, OfferApplication } from '@/api/companies'

export interface RankedRow {
  application: OfferApplication
  suggestion?: ApplicationSuggestion
}

/**
 * Pone primero a quienes la IA puntuó, de mayor a menor afinidad, y deja el
 * resto en su orden original. No quita nada: la lista sigue completa.
 */
export function orderByRanking(applications: OfferApplication[], ranking: ApplicationRanking | null): RankedRow[] {
  if (!ranking) return applications.map((application) => ({ application }))

  const suggestions = new Map(ranking.ranking.map((item) => [item.applicationId, item]))
  const scored = applications
    .filter((application) => suggestions.has(application.id))
    .map((application) => ({ application, suggestion: suggestions.get(application.id) }))
    .sort((a, b) => (b.suggestion?.score ?? 0) - (a.suggestion?.score ?? 0))
  const rest = applications.filter((application) => !suggestions.has(application.id)).map((application) => ({ application }))

  return [...scored, ...rest]
}

export function rankingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.statusCode === 503) return 'La función de IA no está disponible.'
  if (error instanceof ApiError && error.statusCode === 429) return 'Espera un momento antes de volver a intentar.'
  return 'No se pudo obtener la sugerencia, intenta de nuevo.'
}
