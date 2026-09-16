import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type ApplicationDecision,
  type OfferApplication,
  decideApplication,
  listApplicationsForOffer,
} from '@/api/companies'
import { ApiError } from '@/api/client'
import { type Offer, getOffer } from '@/api/offers'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Panel, TableHeaderRow, rowClass } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Ledger } from '@/components/ledger/Ledger'
import { parseLocalDate } from '@/lib/date'

type DecisionState = 'interviewing' | 'accepting' | 'rejecting' | null

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function acceptedCount(applications: OfferApplication[]): number {
  return applications.filter((application) => application.status === 'ACCEPTED').length
}

function ColumnHeader() {
  return (
    <TableHeaderRow>
      <span className="w-40">Estudiante</span>
      <span className="flex-1">Motivación</span>
      <span className="w-28">Enviada</span>
      <span className="w-32">Estado</span>
      <span className="w-60 text-right">Acciones</span>
    </TableHeaderRow>
  )
}

function BackLink() {
  return (
    <Link
      to="/ofertas-empresa"
      className="self-start text-13 font-semibold text-stamp hover:underline"
    >
      ← Volver a mis ofertas
    </Link>
  )
}

/**
 * Ledger de postulaciones de una oferta. A propósito no deshabilita
 * "Aceptar" al llegar al tope de cupos: el backend es la autoridad y
 * devuelve el error si dos aceptaciones simultáneas pasan la verificación
 * de cupos — ocultar el botón en el cliente escondería esa condición de
 * carrera real que el equipo debe poder encontrar.
 */
export function OfferApplicationsPage() {
  const { id } = useParams<{ id: string }>()
  const offerId = Number(id)

  const [offer, setOffer] = useState<Offer | null | undefined>(undefined)
  const [applications, setApplications] = useState<OfferApplication[] | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [decisionState, setDecisionState] = useState<Record<number, DecisionState>>({})
  const [decisionError, setDecisionError] = useState<string | null>(null)

  function refetchApplications() {
    return listApplicationsForOffer(offerId)
      .then((data) => setApplications(data))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las postulaciones'))
  }

  useEffect(() => {
    let cancelled = false
    getOffer(offerId)
      .then((data) => {
        if (!cancelled) setOffer(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setOffer(null)
          setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la oferta')
        }
      })
    listApplicationsForOffer(offerId)
      .then((data) => {
        if (!cancelled) setApplications(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las postulaciones')
        }
      })
    return () => {
      cancelled = true
    }
  }, [offerId])

  async function decide(applicationId: number, status: ApplicationDecision, state: DecisionState) {
    setDecisionError(null)
    setDecisionState((prev) => ({ ...prev, [applicationId]: state }))
    try {
      await decideApplication(applicationId, status)
      await refetchApplications()
    } catch (err) {
      setDecisionError(err instanceof ApiError ? err.message : 'No se pudo enviar la decisión')
    } finally {
      setDecisionState((prev) => ({ ...prev, [applicationId]: null }))
    }
  }

  if (loadError) {
    return (
      <>
        <BackLink />
        <Panel>
          <p role="alert" className="px-5 py-14 text-center text-14 text-void">
            {loadError}
          </p>
        </Panel>
      </>
    )
  }

  if (offer === undefined || applications === undefined) {
    return <LoadingState>Cargando postulaciones…</LoadingState>
  }

  if (offer === null) {
    return null
  }

  const occupied = acceptedCount(applications)
  const remaining = offer.seats - occupied

  return (
    <>
      <BackLink />

      <PageHeader
        title={offer.title}
        subtitle={
          remaining > 0
            ? `${remaining} de ${offer.seats} cupos restantes`
            : `${offer.seats} de ${offer.seats} cupos ocupados`
        }
      />

      {decisionError ? (
        <p role="alert" className="rounded-lg bg-chipVoid px-4 py-3 text-13 text-void">
          {decisionError}
        </p>
      ) : null}

      <Panel
        toolbar={
          applications.length > 0 ? (
            <span className="ml-auto font-data text-12 text-inkSoft">
              {applications.length === 1
                ? '1 postulación'
                : `${applications.length} postulaciones`}
            </span>
          ) : undefined
        }
      >
        {applications.length === 0 ? (
          <EmptyState
            title="Todavía nadie postuló"
            description="Cuando la oferta esté publicada, los estudiantes pueden aplicar."
          />
        ) : (
          <Ledger header={<ColumnHeader />}>
            {applications.map((application) => {
              const state = decisionState[application.id] ?? null
              const busy = state !== null
              const decidable =
                application.status === 'SUBMITTED' || application.status === 'INTERVIEW'
              return (
                <div key={application.id} className={rowClass}>
                  <span className="text-14 font-semibold text-ink sm:w-40">
                    {application.student.fullName}
                  </span>
                  <span className="flex-1">
                    <span className="block max-w-[520px] rounded-md bg-soft px-3 py-2.5 text-13 leading-relaxed text-inkDeep">
                      {application.motivation}
                    </span>
                  </span>
                  <span className="font-data text-13 text-inkSoft sm:w-28">
                    {formatDate(application.submittedAt)}
                  </span>
                  <span className="sm:w-32">
                    <StatusBadge status={application.status} />
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-1.5 sm:w-60">
                    {decidable ? (
                      <>
                        {application.status === 'SUBMITTED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => decide(application.id, 'INTERVIEW', 'interviewing')}
                            disabled={busy}
                          >
                            {state === 'interviewing' ? 'Enviando…' : 'Entrevista'}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => decide(application.id, 'ACCEPTED', 'accepting')}
                          disabled={busy}
                        >
                          {state === 'accepting' ? 'Aceptando…' : 'Aceptar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => decide(application.id, 'REJECTED', 'rejecting')}
                          disabled={busy}
                        >
                          {state === 'rejecting' ? 'Descartando…' : 'Descartar'}
                        </Button>
                      </>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </Ledger>
        )}
      </Panel>
    </>
  )
}
