import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/offline/hooks/useOnline'
import { useSyncStatus } from '@/offline/hooks/useSyncStatus'
import { syncNow } from '@/offline/sync/scheduler'
import { cn } from '@/lib/utils'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function SyncIndicator() {
  const online = useOnline()
  const { pending, lastSyncAt, syncing } = useSyncStatus()
  const [triggering, setTriggering] = useState(false)

  const busy = syncing || triggering

  async function handleSyncNow() {
    setTriggering(true)
    try {
      await syncNow()
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex-none rounded-lg bg-surface px-3.5 py-3"
    >
      <div className="flex items-center gap-2">
        {/* Relleno además de color: sólido en línea, hueco sin conexión. */}
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-2.5 flex-none rounded-full border',
            online ? 'border-stamp bg-stamp' : 'border-2 border-void bg-transparent',
          )}
        />
        <span className={cn('text-13 font-semibold', online ? 'text-ink' : 'text-void')}>
          {online ? 'En línea' : 'Sin conexión'}
        </span>
      </div>

      <p className="mt-1 text-12 leading-relaxed text-inkSoft">
        <span className={cn('font-data', pending > 0 && 'font-semibold text-pending')}>
          {pending} pendiente{pending === 1 ? '' : 's'}
        </span>
        {' · último sync '}
        <span className="font-data">{formatTime(lastSyncAt)}</span>
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2.5 w-full"
        onClick={handleSyncNow}
        disabled={busy}
      >
        {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
      </Button>
    </div>
  )
}
