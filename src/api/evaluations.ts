import { api } from './client'

export type EvaluationKind = 'TUTOR' | 'COMPANY' | 'SELF'

export interface EvaluationScores {
  technical: number
  communication: number
  punctuality: number
}

export interface EvaluationDto {
  placementId: number
  kind: EvaluationKind
  period: string
  scores: EvaluationScores
  comment?: string
}

export interface Evaluation {
  id: number
  placementId: number
  evaluatorId: number
  kind: EvaluationKind
  period: string
  scores: EvaluationScores
  comment: string | null
  submittedAt: string
}

/** Envía una evaluación (rúbrica fija: technical, communication, punctuality). No sincronizable: siempre requiere red. */
export function submitEvaluation(dto: EvaluationDto): Promise<Evaluation> {
  return api<Evaluation>('/evaluations', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}
