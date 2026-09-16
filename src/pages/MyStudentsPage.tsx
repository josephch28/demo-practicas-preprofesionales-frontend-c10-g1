import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Chip } from '@/components/Chip'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Panel, TableHeaderRow, rowClass } from '@/components/Panel'
import { ProgressBar } from '@/components/ProgressBar'
import { StatCard, StatGrid } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Ledger } from '@/components/ledger/Ledger'
import { db, type LocalPlacement } from '@/offline/db'

interface StudentRow {
  placement: LocalPlacement
  approvedHours: number
  submittedHours: number
}

function ColumnHeader() {
  return (
    <TableHeaderRow>
      <span className="w-32">Estudiante</span>
      <span className="flex-1">Empresa</span>
      <span className="w-44">Horas aprobadas</span>
      <span className="w-40">Estado</span>
      <span className="w-24 text-right">Revisión</span>
    </TableHeaderRow>
  )
}

/**
 * Cola de trabajo del tutor: sus placements con el conteo de horas
 * pendientes de revisión por estudiante. Lee de Dexie, no de la red — tiene
 * que funcionar sin señal, igual que el resto de la app.
 */
export function MyStudentsPage() {
  const { user } = useAuth()

  const rows = useLiveQuery<StudentRow[] | undefined>(async () => {
    if (!user) return undefined
    const placements = await db.placements.where('tutorId').equals(user.id).toArray()
    return Promise.all(
      placements.map(async (placement) => {
        const logs = await db.hourLogs.where('placementId').equals(placement.id).toArray()
        let approvedHours = 0
        let submittedHours = 0
        for (const log of logs) {
          if (log.status === 'APPROVED') approvedHours += log.hours
          if (log.status === 'SUBMITTED') submittedHours += log.hours
        }
        return { placement, approvedHours, submittedHours }
      }),
    )
  }, [user?.id])

  if (rows === undefined) {
    return <LoadingState>Cargando tus practicantes…</LoadingState>
  }

  const waiting = rows.filter((row) => row.submittedHours > 0).length
  const pendingHours = rows.reduce((total, row) => total + row.submittedHours, 0)

  return (
    <>
      <PageHeader
        title="Mis practicantes"
        subtitle="Ordenados como los devuelve tu cola: revisá primero lo que está esperando."
      />

      {rows.length > 0 ? (
        <StatGrid>
          <StatCard label="Practicantes" value={String(rows.length)} note="activos" />
          <StatCard
            label="Esperando revisión"
            value={String(waiting)}
            note={waiting === 1 ? 'practicante' : 'practicantes'}
            noteTone={waiting > 0 ? 'pending' : 'neutral'}
          />
          <StatCard
            label="Horas sin revisar"
            value={pendingHours.toFixed(1)}
            note="tu decisión"
            noteTone={pendingHours > 0 ? 'pending' : 'neutral'}
          />
        </StatGrid>
      ) : null}

      <Panel
        toolbar={
          rows.length > 0 ? (
            <span className="ml-auto font-data text-12 text-inkSoft">
              {rows.length === 1 ? '1 practicante' : `${rows.length} practicantes`}
            </span>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Todavía no tienes practicantes asignados"
            description="Cuando la coordinación te asigne uno, aparece acá."
          />
        ) : (
          <Ledger header={<ColumnHeader />}>
            {rows.map(({ placement, approvedHours, submittedHours }) => {
              const requiredHours = placement.requiredHours
              const approvedPct = requiredHours > 0 ? Math.min(100, (approvedHours / requiredHours) * 100) : 0
              return (
                <div key={placement.id} className={rowClass}>
                  <span className="text-14 font-semibold text-ink sm:w-32">
                    Estudiante #{placement.studentId}
                  </span>
                  <span className="flex-1 text-14 text-inkBody">Empresa #{placement.companyId}</span>
                  <span className="flex items-center gap-2.5 sm:w-44">
                    <ProgressBar
                      size="sm"
                      value={approvedPct}
                      label={`Progreso del estudiante ${placement.studentId}`}
                      className="flex-1"
                    />
                    <span className="font-data text-12 text-inkSoft">
                      {approvedHours.toFixed(1)}/{requiredHours}
                    </span>
                  </span>
                  <span className="sm:w-40">
                    {submittedHours > 0 ? (
                      <Chip tone="pending">{submittedHours.toFixed(1)} h sin revisar</Chip>
                    ) : (
                      <Chip tone="stamp">Al día</Chip>
                    )}
                  </span>
                  <span className="sm:w-24 sm:text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/practicantes/${placement.id}/horas`}>Revisar</Link>
                    </Button>
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
