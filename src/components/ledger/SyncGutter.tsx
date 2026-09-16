import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type SyncState = 'local' | 'queued' | 'synced' | 'failed'

// Cada estado se distingue por RELLENO además de por color: hueco, rayado a
// medias, sólido y rayado en diagonal.
const GUTTER: Record<SyncState, { label: string; className: string; style?: CSSProperties }> = {
  local: {
    label: 'Sin sincronizar',
    className: 'bg-transparent border border-inkMute',
  },
  queued: {
    label: 'En cola',
    className: 'border border-dotPending',
    style: {
      backgroundImage:
        'repeating-linear-gradient(180deg, hsl(var(--dot-pending)) 0 4px, transparent 4px 8px)',
    },
  },
  synced: {
    label: 'Sincronizado',
    className: 'bg-stamp border border-stamp',
  },
  failed: {
    label: 'Rechazado',
    className: 'border border-dotVoid',
    style: {
      backgroundImage:
        'repeating-linear-gradient(45deg, hsl(var(--dot-void)) 0 2px, transparent 2px 5px)',
    },
  },
}

export function SyncGutter({ state }: { state: SyncState }) {
  const { label, className, style } = GUTTER[state]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('block w-1 flex-none self-stretch rounded-full', className)}
      style={style}
    />
  )
}
