import { type FormEvent, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { submitEvaluation } from '@/api/evaluations'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Panel, Section } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { parseLocalDate } from '@/lib/date'
import { db, type LocalPlacement } from '@/offline/db'

type ScoreField = 'technical' | 'communication' | 'punctuality'

// Rúbrica fija (technical, communication, punctuality, 1 a 5): una épica
// posterior del backlog la reemplaza por criterios configurables — no se
// adelanta esa flexibilidad aquí.
const CRITERIA: { field: ScoreField; label: string }[] = [
  { field: 'technical', label: 'Desempeño técnico' },
  { field: 'communication', label: 'Comunicación' },
  { field: 'punctuality', label: 'Puntualidad' },
]

const SCORE_OPTIONS = ['1', '2', '3', '4', '5']

// Periodo académico AAAA-1 (enero-junio) o AAAA-2 (julio-diciembre), tal
// como lo espera el backend (ver AccreditationService.reportForPeriod). Se
// deriva de la fecha de inicio del placement: la rúbrica no le pide este
// dato al tutor.
function periodFromStartDate(startDate: string): string {
  const parsed = parseLocalDate(startDate)
  const year = parsed.getFullYear()
  const term = parsed.getMonth() < 6 ? 1 : 2
  return `${year}-${term}`
}

/** Evaluación del tutor sobre un placement: rúbrica fija + comentario. No sincronizable: siempre requiere red. */
export function EvaluatePage() {
  const { id } = useParams<{ id: string }>()
  const placementId = Number(id)

  const placement = useLiveQuery<LocalPlacement | null | undefined>(async () => {
    const found = await db.placements.get(placementId)
    return found ?? null
  }, [placementId])

  const [scores, setScores] = useState<Record<ScoreField, string>>({
    technical: '',
    communication: '',
    punctuality: '',
  })
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Partial<Record<ScoreField, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (placement === undefined) {
    return <LoadingState>Cargando practicante…</LoadingState>
  }

  if (placement === null) {
    return <EmptyState title="No se encontró este practicante" />
  }

  const period = periodFromStartDate(placement.startDate)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors: Partial<Record<ScoreField, string>> = {}
    for (const { field } of CRITERIA) {
      if (!scores[field]) nextErrors[field] = 'Selecciona un puntaje'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await submitEvaluation({
        placementId,
        kind: 'TUTOR',
        period,
        scores: {
          technical: Number(scores.technical),
          communication: Number(scores.communication),
          punctuality: Number(scores.punctuality),
        },
        comment: comment.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'No se pudo enviar la evaluación')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Evaluar practicante"
        subtitle={`Estudiante #${placement.studentId} · Empresa #${placement.companyId} · periodo ${period}`}
        actions={
          <Button asChild variant="outline">
            <Link to={`/practicantes/${placementId}/horas`}>Ver libro de horas</Link>
          </Button>
        }
      />

      {submitted ? (
        <Panel>
          <EmptyState
            title="Evaluación enviada"
            description="La coordinación ya la puede ver en el acta del periodo."
            action={
              <Button asChild size="sm">
                <Link to="/practicantes">Volver a mis practicantes</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <Section title="Rúbrica">
          <form className="flex flex-col gap-4 px-[18px] py-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              {CRITERIA.map(({ field, label }) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <Label htmlFor={`eval-${field}`}>{label}</Label>
                  <Select
                    value={scores[field]}
                    onValueChange={(value) => setScores((prev) => ({ ...prev, [field]: value }))}
                  >
                    <SelectTrigger
                      id={`eval-${field}`}
                      className="font-data"
                      aria-invalid={Boolean(errors[field])}
                    >
                      <SelectValue placeholder="1 a 5" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option} className="font-data">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[field] ? (
                    <p role="alert" className="text-12 text-void">
                      {errors[field]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eval-comment">Comentario</Label>
              <p className="text-12 text-inkSoft">
                Opcional. Queda en el acta junto con los puntajes.
              </p>
              <Textarea
                id="eval-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                placeholder="Observaciones sobre el desempeño del practicante"
              />
            </div>

            {submitError ? (
              <p role="alert" className="rounded-md bg-chipVoid px-3 py-2.5 text-13 text-void">
                {submitError}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="self-start">
              {submitting ? 'Enviando…' : 'Enviar evaluación'}
            </Button>
          </form>
        </Section>
      )}
    </>
  )
}
