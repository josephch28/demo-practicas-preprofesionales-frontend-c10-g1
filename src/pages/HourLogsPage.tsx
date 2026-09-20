import { useState } from 'react'
import { HourLogForm } from '@/components/HourLogForm'
import { HoursProgressPanel } from '@/components/HoursProgressPanel'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Ledger, LedgerHeaderRow } from '@/components/ledger/Ledger'
import { LedgerRow } from '@/components/ledger/LedgerRow'
import { parseLocalDate } from '@/lib/date'
import { type HoursSummary, summarizeHours } from '@/lib/hours'
import { plural } from '@/lib/utils'
import { db, type LocalHourLog } from '@/offline/db'
import { useHourLogs } from '@/offline/hooks/useHourLogs'
import { usePlacement } from '@/offline/hooks/usePlacement'

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function LedgerColumnHeader() {
  return (
    <LedgerHeaderRow>
      <span className="w-28">Fecha</span>
      <span className="w-28">Horario</span>
      <span className="w-14">Horas</span>
      <span className="flex-1">Actividad</span>
      <span className="w-32 text-right">Estado</span>
    </LedgerHeaderRow>
  )
}

function submittedNote(hours: HoursSummary) {
  if (hours.submittedHours <= 0) return null
  return <span className="text-pending"> · {hours.submittedHours.toFixed(1)} sin aprobar</span>
}

function HourLogsList({ logs }: { logs: LocalHourLog[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        title="Todavía no has registrado horas"
        description="Puedes hacerlo sin conexión: se sincroniza cuando vuelva la señal."
      />
    )
  }

  async function dismissReviewNote(logId: number) {
    // El estado del servidor ya está aplicado en la fila (conflict.ts hizo
    // spread de serverFields), así que solo falta limpiar el indicador de
    // fallo y la nota para que vuelva a verse normal.
    await db.hourLogs.update(logId, { syncState: 'synced', reviewNote: null })
  }

  return (
    <Ledger header={<LedgerColumnHeader />}>
      {logs
        .slice()
        .reverse()
        .map((log) => (
          <div key={log.id}>
            <LedgerRow syncState={log.syncState}>
              <span className="font-data text-14 text-ink sm:w-28">{formatDate(log.date)}</span>
              <span className="font-data text-13 text-inkSoft sm:w-28">
                {log.startTime}–{log.endTime}
              </span>
              <span className="font-data text-14 text-ink sm:w-14">{log.hours}</span>
              <span className="flex-1 text-14 text-inkBody">{log.activity}</span>
              <span className="sm:w-32 sm:text-right">
                <StatusBadge status={log.status} />
              </span>
            </LedgerRow>
            {log.syncState === 'failed' && log.reviewNote && (
              <div className="flex items-start gap-2 rounded-md bg-void/10 mx-[18px] mb-2 px-3 py-2">
                <span className="shrink-0 text-14 text-void" aria-hidden>⚠</span>
                <p className="flex-1 text-12 text-void">{log.reviewNote}</p>
                <button
                  type="button"
                  className="shrink-0 text-12 font-medium text-void underline hover:text-void/70"
                  onClick={() => dismissReviewNote(log.id)}
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        ))}
    </Ledger>
  )
}

function NewHourLogDialog({ placementId }: { placementId: number }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Registrar horas</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar horas</DialogTitle>
          <DialogDescription>
            Se guardan en este dispositivo y se sincronizan cuando haya conexión
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <HourLogForm placementId={placementId} onSaved={() => setOpen(false)} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export function HourLogsPage() {
  const placement = usePlacement()
  const logs = useHourLogs(placement?.id ?? -1)

  if (placement === undefined) {
    return <LoadingState>Cargando tu práctica…</LoadingState>
  }

  if (placement === null) {
    return (
      <EmptyState
        title="No tienes una práctica activa todavía"
        description="Cuando la coordinación active tu plaza, vas a poder registrar horas."
      />
    )
  }

  if (logs === undefined) {
    return <LoadingState>Cargando registros de horas…</LoadingState>
  }

  // Totales recalculados en cada render a propósito: con esta pantalla no
  // hace falta más que sumar un arreglo, así que no se envuelve en useMemo.
  const hours = summarizeHours(logs, placement.requiredHours)

  return (
    <>
      <PageHeader
        title="Libro de horas"
        subtitle="Todo lo que registraste este período. Se guarda en este dispositivo aunque no haya señal."
        actions={<NewHourLogDialog placementId={placement.id} />}
      />

      <HoursProgressPanel hours={hours} note={submittedNote(hours)} />

      <Panel
        toolbar={
          <span className="ml-auto font-data text-12 text-inkSoft">
            {plural(logs.length, 'registro', 'registros')}
          </span>
        }
      >
        <HourLogsList logs={logs} />
      </Panel>
    </>
  )
}
