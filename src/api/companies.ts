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
