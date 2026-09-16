import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Botonera de la derecha: la acción primaria va última. */
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-5 gap-y-3', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-26 font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-14 text-inkMid">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
