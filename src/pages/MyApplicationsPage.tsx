import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Application, listMine } from '@/api/applications'
import { ApiError } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  TableHeaderRow,
  rowClass,
} from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Ledger } from '@/components/ledger/Ledger'
import { parseLocalDate } from '@/lib/date'

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function ColumnHeader() {
  return (
    <TableHeaderRow>
      <span className="w-40">Empresa</span>
      <span className="flex-1">Oferta</span>
      <span className="w-32">Enviada</span>
      <span className="w-32 text-right">Estado</span>
    </TableHeaderRow>
  )
}

export function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listMine()
      .then((data) => {
        if (!cancelled) setApplications(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus postulaciones')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageHeader
        title="Mis postulaciones"
        subtitle="El estado de cada oferta a la que aplicaste, según respondan las empresas."
      />

      <Panel
        toolbar={
          applications && applications.length > 0 ? (
            <span className="ml-auto font-data text-12 text-inkSoft">
              {applications.length === 1
                ? '1 postulación'
                : `${applications.length} postulaciones`}
            </span>
          ) : undefined
        }
      >
        {error ? (
          <ErrorState>{error}</ErrorState>
        ) : applications === undefined ? (
          <LoadingState>Cargando postulaciones…</LoadingState>
        ) : applications.length === 0 ? (
          <EmptyState
            title="Todavía no has postulado a ninguna oferta"
            description="Mirá las ofertas abiertas y postulá a la que te sirva."
            action={
              <Button asChild size="sm">
                <Link to="/ofertas">Ver ofertas</Link>
              </Button>
            }
          />
        ) : (
          <Ledger header={<ColumnHeader />}>
            {applications.map((application) => (
              <Link key={application.id} to={`/ofertas/${application.offerId}`} className={rowClass}>
                <span className="text-14 text-inkBody sm:w-40">
                  {application.offer.company.name}
                </span>
                <span className="flex-1 text-14 font-semibold text-ink">
                  {application.offer.title}
                </span>
                <span className="font-data text-13 text-inkSoft sm:w-32">
                  {formatDate(application.submittedAt)}
                </span>
                <span className="sm:w-32 sm:text-right">
                  <StatusBadge status={application.status} />
                </span>
              </Link>
            ))}
          </Ledger>
        )}
      </Panel>
    </>
  )
}
