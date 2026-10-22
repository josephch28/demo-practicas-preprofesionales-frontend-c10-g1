import { useState } from 'react'
import { type ApplicationRanking, rankApplicationsForOffer } from '@/api/companies'
import { rankingErrorMessage } from '@/lib/application-ranking'

/** Estado de la sugerencia de la IA para una oferta. Nunca toca las postulaciones. */
export function useApplicationRanking(offerId: number) {
  const [ranking, setRanking] = useState<ApplicationRanking | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function suggest() {
    setLoading(true)
    setError(null)
    try {
      setRanking(await rankApplicationsForOffer(offerId))
    } catch (err) {
      setError(rankingErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setRanking(null)
    setError(null)
  }

  return { ranking, loading, error, suggest, clear }
}
