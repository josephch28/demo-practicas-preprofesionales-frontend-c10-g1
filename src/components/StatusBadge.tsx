import { Chip, type ChipTone } from '@/components/Chip'

const STATUS_TONE: Record<string, ChipTone> = {
  APPROVED: 'stamp',
  ACCEPTED: 'stamp',
  ACTIVE: 'stamp',
  VALIDATED: 'stamp',
  PUBLISHED: 'stamp',
  ACREDITADO: 'stamp',
  SUBMITTED: 'pending',
  PENDING: 'pending',
  PENDING_DOCS: 'pending',
  INTERVIEW: 'pending',
  DRAFT: 'pending',
  PENDIENTE: 'pending',
  ACREDITADO_CON_OBSERVACIONES: 'pending',
  REJECTED: 'void',
  ABANDONED: 'void',
  SUSPENDED: 'void',
  CLOSED: 'void',
  WITHDRAWN: 'void',
  NO_ACREDITADO: 'void',
}

export function StatusBadge({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Chip>
}
