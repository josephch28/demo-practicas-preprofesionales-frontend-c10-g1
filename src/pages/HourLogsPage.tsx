import { memo, useMemo, useState } from 'react'
import { HourLogForm } from '@/components/HourLogForm'
import { HoursProgressPanel } from '@/components/HoursProgressPanel'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Panel } from '@/components/Panel'
import { ReviewNoteBanner } from '@/components/ReviewNoteBanner'
import { StatusBadge } from '@/components/StatusBadge'
import { VoiceNotesPanel } from '@/components/VoiceNotesPanel'
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
import { formatShortDate } from '@/lib/date'
import { type HoursSummary, sameHourLogRow, summarizeHours } from '@/lib/hours'
import { plural } from '@/lib/utils'
import type { LocalHourLog, LocalVoiceNote } from '@/offline/db'
import { useHourLogs } from '@/offline/hooks/useHourLogs'
import { usePlacement } from '@/offline/hooks/usePlacement'

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

const HourLogRow = memo(
  function HourLogRow({ log }: { log: LocalHourLog }) {
    return (
      <div>
        <LedgerRow syncState={log.syncState}>
          <span className="font-data text-14 text-ink sm:w-28">{formatShortDate(log.date)}</span>
          <span className="font-data text-13 text-inkSoft sm:w-28">
            {log.startTime}–{log.endTime}
          </span>
          <span className="font-data text-14 text-ink sm:w-14">{log.hours}</span>
          <span className="flex-1 text-14 text-inkBody">{log.activity}</span>
          <span className="sm:w-32 sm:text-right">
            <StatusBadge status={log.status} />
          </span>
        </LedgerRow>
        <ReviewNoteBanner log={log} />
      </div>
    )
  },
  (prev, next) => sameHourLogRow(prev.log, next.log),
)

const HourLogsList = memo(function HourLogsList({ logs }: { logs: LocalHourLog[] }) {
  // Más reciente primero. Va antes del return anticipado (regla de los hooks).
  const newestFirst = useMemo(() => logs.slice().reverse(), [logs])

  if (logs.length === 0) {
    return (
      <EmptyState
        title="Todavía no has registrado horas"
        description="Puedes hacerlo sin conexión: se sincroniza cuando vuelva la señal."
      />
    )
  }

  return (
    <Ledger header={<LedgerColumnHeader />}>
      {newestFirst.map((log) => (
        <HourLogRow key={log.id} log={log} />
      ))}
    </Ledger>
  )
})

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
  const [, setReviewingNote] = useState<LocalVoiceNote | null>(null)
  const requiredHours = placement?.requiredHours ?? 0
  const hours = useMemo(() => summarizeHours(logs, requiredHours), [logs, requiredHours])

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

  return (
    <>
      <PageHeader
        title="Libro de horas"
        subtitle="Todo lo que registraste este período. Se guarda en este dispositivo aunque no haya señal."
        actions={<NewHourLogDialog placementId={placement.id} />}
      />

      <VoiceNotesPanel onReview={setReviewingNote} />

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