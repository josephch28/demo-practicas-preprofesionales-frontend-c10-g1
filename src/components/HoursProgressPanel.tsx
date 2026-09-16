import type { ReactNode } from 'react'
import { ProgressBar } from '@/components/ProgressBar'
import type { HoursSummary } from '@/lib/hours'

interface HoursProgressPanelProps {
  hours: HoursSummary
  /** Glosa que se agrega al contador, normalmente lo que está sin resolver. */
  note?: ReactNode
}

/** Panel de avance de horas: contador arriba, barra de dos tramos abajo. */
export function HoursProgressPanel({ hours, note }: HoursProgressPanelProps) {
  return (
    <section className="rounded-2xl bg-surface px-[18px] py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-15 font-semibold text-ink">Progreso de horas</h2>
        <p className="font-data text-13 text-inkSoft">
          {hours.approvedHours.toFixed(1)} / {hours.requiredHours} aprobadas
          {note}
        </p>
      </div>
      <ProgressBar
        className="mt-3"
        value={hours.approvedPct}
        pendingValue={hours.submittedPct}
        label="Progreso de horas aprobadas"
      />
    </section>
  )
}
