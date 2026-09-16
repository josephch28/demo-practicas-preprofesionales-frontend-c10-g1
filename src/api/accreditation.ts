import { api } from './client'

export type AccreditationLevel = 'ACREDITADO' | 'ACREDITADO_CON_OBSERVACIONES' | 'PENDIENTE' | 'NO_ACREDITADO'

export interface AccreditationRow {
  placementId: number
  studentName: string
  level: AccreditationLevel
  reasons: string[]
  completionPercentage: number
}

/**
 * Acta de acreditación para un periodo académico (formato AAAA-1 o AAAA-2).
 * No sincronizable: siempre requiere red. El backend exige `period` — sin él
 * responde 400, así que nunca se llama con un valor vacío.
 */
export function reportForPeriod(period: string): Promise<AccreditationRow[]> {
  return api<AccreditationRow[]>(`/placements/accreditation?period=${encodeURIComponent(period)}`)
}
