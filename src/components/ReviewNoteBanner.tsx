import { db, type LocalHourLog } from '@/offline/db'

export function ReviewNoteBanner({ log }: { log: LocalHourLog }) {
  if (log.syncState !== 'failed' || !log.reviewNote) {
    return null
  }

  return (
    <div className="flex items-start gap-2 rounded-md bg-void/10 mx-[18px] mb-2 px-3 py-2">
      <span className="shrink-0 text-14 text-void" aria-hidden>
        ⚠
      </span>
      <p className="flex-1 text-12 text-void">{log.reviewNote}</p>
      <button
        type="button"
        className="shrink-0 text-12 font-medium text-void underline hover:text-void/70"
        onClick={() => {
          db.hourLogs.update(log.id, { syncState: 'synced', reviewNote: null })
        }}
      >
        Entendido
      </button>
    </div>
  )
}
