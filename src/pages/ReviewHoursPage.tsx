import { type FormEvent, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '@/api/client'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Ledger, LedgerHeaderRow } from '@/components/ledger/Ledger'
import { LedgerRow } from '@/components/ledger/LedgerRow'
import { parseLocalDate } from '@/lib/date'
import { summarizeHours } from '@/lib/hours'
import { plural } from '@/lib/utils'
import { db, type LocalHourLog, type LocalPlacement } from '@/offline/db'
import { syncNow } from '@/offline/sync/scheduler'

type ActionState = 'approving' | 'rejecting' | 'approved' | 'rejected' | null

// Los motivos que más se repiten al devolver un registro: se pegan al final
// de la nota para que el tutor no escriba lo mismo cada vez.
const COMMON_REASONS = [
  'Las horas no coinciden con el sitio',
  'Falta detalle de la actividad',
  'La fecha no corresponde',
]

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
      <span className="w-32">Estado</span>
      <span className="w-44 text-right">Revisión</span>
    </LedgerHeaderRow>
  )
}

interface ReviewActionsProps {
  log: LocalHourLog
  state: ActionState
  onApprove: (logId: number) => void
  onReject: (log: LocalHourLog) => void
}

function ReviewActions({ log, state, onApprove, onReject }: ReviewActionsProps) {
  if (state === 'approved') {
    return <span className="text-13 font-semibold text-stamp">Aprobada</span>
  }
  if (state === 'rejected') {
    return <span className="text-13 font-semibold text-void">Rechazada</span>
  }
  if (log.status !== 'SUBMITTED') return null

  const busy = state === 'approving' || state === 'rejecting'
  return (
    <>
      <Button type="button" size="sm" onClick={() => onApprove(log.id)} disabled={busy}>
        {state === 'approving' ? 'Aprobando…' : 'Aprobar'}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onReject(log)} disabled={busy}>
        Devolver
      </Button>
    </>
  )
}

interface ReviewListProps {
  logs: LocalHourLog[]
  actionState: Record<number, ActionState>
  onApprove: (logId: number) => void
  onReject: (log: LocalHourLog) => void
}

function ReviewList({ logs, actionState, onApprove, onReject }: ReviewListProps) {
  if (logs.length === 0) {
    return (
      <EmptyState
        title="No tienes horas pendientes de revisar"
        description="Cuando tu practicante envíe horas nuevas, aparecen acá."
      />
    )
  }

  return (
    <Ledger header={<LedgerColumnHeader />}>
      {logs
        .slice()
        .reverse()
        .map((log) => (
          <LedgerRow key={log.id} syncState={log.syncState}>
            <span className="font-data text-14 text-ink sm:w-28">{formatDate(log.date)}</span>
            <span className="font-data text-13 text-inkSoft sm:w-28">
              {log.startTime}–{log.endTime}
            </span>
            <span className="font-data text-14 text-ink sm:w-14">{log.hours}</span>
            <span className="flex-1 text-14 text-inkBody">{log.activity}</span>
            <span className="sm:w-32">
              <StatusBadge status={log.status} />
            </span>
            <span className="flex flex-wrap justify-end gap-1.5 sm:w-44">
              <ReviewActions
                log={log}
                state={actionState[log.id] ?? null}
                onApprove={onApprove}
                onReject={onReject}
              />
            </span>
          </LedgerRow>
        ))}
    </Ledger>
  )
}

interface RejectDialogProps {
  /** Registro a devolver, o `null` con el modal cerrado. */
  log: LocalHourLog | null
  onCancel: () => void
  onConfirm: (logId: number, note: string) => void
}

function RejectDialog({ log, onCancel, onConfirm }: RejectDialogProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(open: boolean) {
    if (open) return
    setNote('')
    setError(null)
    onCancel()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!log) return
    const trimmed = note.trim()
    if (!trimmed) {
      setError('Escribe una nota para el rechazo')
      return
    }
    setNote('')
    setError(null)
    onConfirm(log.id, trimmed)
  }

  function appendReason(reason: string) {
    setNote((prev) => (prev ? `${prev.replace(/\s*$/, '')} ${reason}. ` : `${reason}. `))
    setError(null)
  }

  return (
    <Dialog open={log !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver el registro</DialogTitle>
          <DialogDescription>
            {log ? `${formatDate(log.date)} · ${log.activity} · ${log.hours} h` : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reject-note">¿Qué tiene que corregir?</Label>
              <p className="text-12 text-inkSoft">
                Lo lee tal cual lo escribas, con tu nombre y la fecha.
              </p>
              <Textarea
                id="reject-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Escribe qué falta o qué está mal"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'reject-note-error' : undefined}
              />
              {error ? (
                <p id="reject-note-error" role="alert" className="text-12 text-void">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-12 uppercase tracking-[0.06em] text-inkMute">
                Motivos frecuentes
              </span>
              <div className="flex flex-wrap gap-2">
                {COMMON_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => appendReason(reason)}
                    className="inline-flex h-8 items-center rounded-full border border-line px-3 text-13 text-inkBody transition-colors hover:border-stamp hover:bg-soft hover:text-ink"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">Devolver el registro</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function pendingNote(pendingCount: number) {
  if (pendingCount === 0) return null
  return (
    <span className="text-pending">
      {' '}
      · {plural(pendingCount, 'registro', 'registros')} sin revisar
    </span>
  )
}

/**
 * Cola de aprobación de un placement. Las horas viven en Dexie (sincronizadas
 * por pull/push); aprobar o rechazar llama al backend y luego re-sincroniza
 * para traer el estado nuevo — el servidor es la autoridad, nunca se escribe
 * el resultado de la revisión a mano en Dexie.
 *
 * Nota: el backend no valida que quien revisa sea el tutor asignado a este
 * placement (deuda del backend). Esta pantalla no lo compensa ocultando ni
 * deshabilitando nada.
 */
export function ReviewHoursPage() {
  const { id } = useParams<{ id: string }>()
  const placementId = Number(id)

  const placement = useLiveQuery<LocalPlacement | null | undefined>(async () => {
    const found = await db.placements.get(placementId)
    return found ?? null
  }, [placementId])

  const logs = useLiveQuery<LocalHourLog[] | undefined>(
    () => db.hourLogs.where('placementId').equals(placementId).sortBy('date'),
    [placementId],
  )

  const [actionState, setActionState] = useState<Record<number, ActionState>>({})
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [rejectingLog, setRejectingLog] = useState<LocalHourLog | null>(null)

  async function reviewLog(logId: number, status: 'APPROVED' | 'REJECTED', note?: string) {
    setReviewError(null)
    setActionState((prev) => ({ ...prev, [logId]: status === 'APPROVED' ? 'approving' : 'rejecting' }))
    try {
      await api(`/hour-logs/${logId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      })
      await syncNow()
      setActionState((prev) => ({ ...prev, [logId]: status === 'APPROVED' ? 'approved' : 'rejected' }))
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'No se pudo enviar la revisión')
      setActionState((prev) => ({ ...prev, [logId]: null }))
    }
  }

  function confirmReject(logId: number, note: string) {
    setRejectingLog(null)
    void reviewLog(logId, 'REJECTED', note)
  }

  if (placement === undefined || logs === undefined) {
    return <LoadingState>Cargando libro de horas…</LoadingState>
  }

  if (placement === null) {
    return <EmptyState title="No se encontró este practicante" />
  }

  const hours = summarizeHours(logs, placement.requiredHours)
  const pendingCount = logs.filter((log) => log.status === 'SUBMITTED').length

  return (
    <>
      <PageHeader
        title="Horas del practicante"
        subtitle={`Estudiante #${placement.studentId} · Empresa #${placement.companyId}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/practicantes">Volver a la lista</Link>
            </Button>
            <Button asChild>
              <Link to={`/practicantes/${placementId}/evaluar`}>Evaluar practicante</Link>
            </Button>
          </>
        }
      />

      <HoursProgressPanel hours={hours} note={pendingNote(pendingCount)} />

      {reviewError ? (
        <p role="alert" className="rounded-lg bg-chipVoid px-4 py-3 text-13 text-void">
          {reviewError}
        </p>
      ) : null}

      <Panel
        toolbar={
          <span className="ml-auto font-data text-12 text-inkSoft">
            {plural(pendingCount, 'registro', 'registros')} sin revisar
          </span>
        }
      >
        <ReviewList
          logs={logs}
          actionState={actionState}
          onApprove={(logId) => reviewLog(logId, 'APPROVED')}
          onReject={setRejectingLog}
        />
      </Panel>

      <RejectDialog
        log={rejectingLog}
        onCancel={() => setRejectingLog(null)}
        onConfirm={confirmReject}
      />
    </>
  )
}
