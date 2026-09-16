import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type NoteTone = 'neutral' | 'pending' | 'void' | 'stamp'

const NOTE_CLASSES: Record<NoteTone, string> = {
  neutral: 'text-inkSoft',
  pending: 'text-pending',
  void: 'text-void',
  stamp: 'text-stamp',
}

interface StatCardProps {
  label: ReactNode
  value: ReactNode
  /** Glosa breve junto al número: "de 240", "sin aprobar". */
  note?: ReactNode
  noteTone?: NoteTone
  className?: string
}

export function StatCard({ label, value, note, noteTone = 'neutral', className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl bg-surface px-[18px] py-4', className)}>
      <div className="text-12 text-inkSoft">{label}</div>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-data text-26 font-semibold leading-none text-ink">{value}</span>
        {note ? (
          <span className={cn('text-12 font-semibold', NOTE_CLASSES[noteTone])}>{note}</span>
        ) : null}
      </div>
    </div>
  )
}

/** Rejilla de KPIs: se adapta al ancho sin romper la altura de las tarjetas. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">{children}</div>
  )
}
