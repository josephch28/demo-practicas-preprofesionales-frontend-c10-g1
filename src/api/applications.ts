import { api } from './client'
import type { Offer } from './offers'

export type ApplicationStatus = 'SUBMITTED' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export interface Application {
  id: number
  offerId: number
  studentId: number
  status: ApplicationStatus
  motivation: string
  submittedAt: string
  decidedAt: string | null
  offer: Offer
}

/** Postula a una oferta. No sincronizable: siempre requiere red. */
export function apply(offerId: number, motivation: string): Promise<Application> {
  return api<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify({ offerId, motivation }),
  })
}

/** Postulaciones del estudiante autenticado, con la oferta incluida. */
export function listMine(): Promise<Application[]> {
  return api<Application[]>('/applications/me')
}
