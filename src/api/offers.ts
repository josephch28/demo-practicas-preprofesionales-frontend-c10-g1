import { api } from './client'

export interface OfferCompany {
  id: number
  name: string
}

export interface Offer {
  id: number
  companyId: number
  title: string
  description: string
  modality: string
  seats: number
  requiredHours: number
  periodStart: string
  periodEnd: string
  status: string
  publishedAt: string | null
  company: OfferCompany
}

/** Ofertas publicadas. No sincronizable: siempre requiere red. */
export function listOffers(): Promise<Offer[]> {
  return api<Offer[]>('/offers')
}

export function getOffer(id: number): Promise<Offer> {
  return api<Offer>(`/offers/${id}`)
}
