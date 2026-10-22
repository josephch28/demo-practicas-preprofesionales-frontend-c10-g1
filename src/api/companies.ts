import type { ApplicationStatus } from './applications'
import { api } from './client'
import type { Offer } from './offers'

export interface Company {
  id: number
  taxId: string
  name: string
  sector: string
  contactEmail: string
  verified: boolean
  createdAt: string
}

export interface CreateOfferDto {
  companyId: number
  title: string
  description: string
  modality: string
  seats: number
  requiredHours: number
  periodStart: string
  periodEnd: string
}

/**
 * Oferta de la empresa autenticada, con las postulaciones incluidas (solo el
 * estado) para poder mostrar cupos ocupados sin una llamada por fila.
 */
export interface CompanyOffer extends Offer {
  applications: { status: ApplicationStatus }[]
}

export interface OfferApplicant {
  id: number
  fullName: string
  email: string
}

export interface OfferApplication {
  id: number
  offerId: number
  studentId: number
  status: ApplicationStatus
  motivation: string
  submittedAt: string
  decidedAt: string | null
  student: OfferApplicant
}

/** Una sugerencia de la IA para una postulación: afinidad de 0 a 100 y por qué. */
export interface ApplicationSuggestion {
  applicationId: number
  score: number
  reason: string
}

export interface ApplicationRanking {
  offerId: number
  ranking: ApplicationSuggestion[]
  unranked: number[]
  truncated: boolean
}

export type ApplicationDecision = Extract<ApplicationStatus, 'INTERVIEW' | 'ACCEPTED' | 'REJECTED'>

/** Empresas registradas. No sincronizable: siempre requiere red. */
export function listCompanies(): Promise<Company[]> {
  return api<Company[]>('/companies')
}

/** Ofertas de la empresa autenticada, en cualquier estado (DRAFT/PUBLISHED/CLOSED). */
export function listMyOffers(): Promise<CompanyOffer[]> {
  return api<CompanyOffer[]>('/offers/me')
}

export function createOffer(dto: CreateOfferDto): Promise<Offer> {
  return api<Offer>('/offers', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export function publishOffer(id: number): Promise<Offer> {
  return api<Offer>(`/offers/${id}/publish`, { method: 'PATCH' })
}

export function closeOffer(id: number): Promise<Offer> {
  return api<Offer>(`/offers/${id}/close`, { method: 'PATCH' })
}

/** Postulaciones de una oferta, con el estudiante incluido. */
export function listApplicationsForOffer(offerId: number): Promise<OfferApplication[]> {
  return api<OfferApplication[]>(`/offers/${offerId}/applications`)
}

export function decideApplication(id: number, status: ApplicationDecision): Promise<OfferApplication> {
  return api<OfferApplication>(`/applications/${id}/decide`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

/** Pide a la IA un orden de afinidad de las postulaciones pendientes. Requiere red. */
export function rankApplicationsForOffer(offerId: number): Promise<ApplicationRanking> {
  return api<ApplicationRanking>(`/offers/${offerId}/applications/rank`, { method: 'POST' })
}
