import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LocalHourLog } from '@/offline/db'

/**
 * Lee los registros de horas de un placement desde Dexie. Nunca hace fetch:
 * los datos ya viven localmente gracias a pull/push, así que la pantalla
 * funciona igual con o sin conexión.
 */
export function useHourLogs(placementId: number): LocalHourLog[] | undefined {
  return useLiveQuery(
    () => db.hourLogs.where('placementId').equals(placementId).sortBy('date'),
    [placementId],
  )
}
