import type { ApplicationRanking, ApplicationSuggestion } from '@/api/companies'
import { Chip, type ChipTone } from '@/components/Chip'
import { Button } from '@/components/ui/button'

interface ApplicationRankingBarProps {
  /** Postulaciones que todavía se pueden decidir: con menos de 2 no hay nada que ordenar. */
  pendingCount: number
  online: boolean
  loading: boolean
  ranking: ApplicationRanking | null
  error: string | null
  onSuggest: () => void
  onClear: () => void
}

export const AI_DISCLAIMER = 'Sugerencia de IA basada en el motivo de cada postulante. La decisión es tuya.'

function affinityTone(score: number): ChipTone {
  if (score >= 70) return 'stamp'
  if (score >= 40) return 'pending'
  return 'neutral'
}

/** Insignia y motivo bajo la motivación de un postulante. */
export function AffinityNote({ suggestion }: { suggestion: ApplicationSuggestion }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2">
      <Chip tone={affinityTone(suggestion.score)} dot={false}>
        <span aria-label={`Afinidad ${suggestion.score} de 100`}>Afinidad {suggestion.score}/100</span>
      </Chip>
      {suggestion.reason ? <span className="text-12 text-inkSoft">{suggestion.reason}</span> : null}
    </span>
  )
}

function RankingNotes({ online, ranking, error }: Pick<ApplicationRankingBarProps, 'online' | 'ranking' | 'error'>) {
  return (
    <>
      {!online && !ranking ? (
        <span className="text-12 text-inkSoft">La sugerencia necesita conexión a internet.</span>
      ) : null}
      {ranking ? <span className="text-12 text-inkSoft">{AI_DISCLAIMER}</span> : null}
      {ranking?.truncated ? (
        <span className="text-12 text-pending">Se evaluaron las 50 postulaciones más recientes.</span>
      ) : null}
      {error ? (
        <span role="alert" className="text-12 text-void">
          {error}
        </span>
      ) : null}
    </>
  )
}

export function ApplicationRankingBar({
  pendingCount,
  online,
  loading,
  ranking,
  error,
  onSuggest,
  onClear,
}: ApplicationRankingBarProps) {
  if (!ranking && pendingCount < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {ranking ? (
        <Button type="button" size="sm" variant="outline" onClick={onClear}>
          Quitar sugerencia
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={onSuggest} disabled={loading || !online}>
          {loading ? 'Analizando…' : 'Sugerir mejores postulantes'}
        </Button>
      )}

      <RankingNotes online={online} ranking={ranking} error={error} />
    </div>
  )
}
