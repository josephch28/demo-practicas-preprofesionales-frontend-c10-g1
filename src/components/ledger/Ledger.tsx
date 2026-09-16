import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LedgerProps {
  header?: ReactNode
  children: ReactNode
  className?: string
}

export function Ledger({ header, children, className }: LedgerProps) {
  return (
    <div className={cn('divide-y divide-paperRule', className)}>
      {header ? (
        <div className="bg-well font-display text-12 text-inkSoft">{header}</div>
      ) : null}
      {children}
    </div>
  )
}

/** Fila de cabecera: mismo reparto de columnas que las filas de datos. */
export function LedgerHeaderRow({ children }: { children: ReactNode }) {
  return (
    <div className="hidden items-center gap-3 px-[18px] py-2.5 sm:flex">
      <span aria-hidden="true" className="block w-1 flex-none" />
      <div className="flex flex-1 items-center gap-3">{children}</div>
    </div>
  )
}
