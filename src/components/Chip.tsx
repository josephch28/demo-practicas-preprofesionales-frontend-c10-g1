import { cn } from '@/lib/utils'

/**
 * Tono semántico de un chip. `stamp` es el estado resuelto (aprobado,
 * publicado, activo), `pending` el que espera una decisión, `void` el que
 * volvió rechazado y `neutral` el que no comunica estado.
 */
export type ChipTone = 'stamp' | 'pending' | 'void' | 'neutral'

const TONE_CLASSES: Record<ChipTone, string> = {
  stamp: 'bg-chipStamp text-stamp',
  pending: 'bg-chipPending text-pending',
  void: 'bg-chipVoid text-void',
  neutral: 'bg-soft text-inkSoft',
}

// El punto lleva su propio color: en los tonos claros el texto no tiene
// suficiente contra el fondo del chip para leerse como indicador.
const DOT_CLASSES: Record<ChipTone, string> = {
  stamp: 'bg-stamp',
  pending: 'bg-dotPending',
  void: 'bg-dotVoid',
  neutral: 'bg-inkMute',
}

interface ChipProps {
  tone?: ChipTone
  /** El cuadradito de color a la izquierda. Se oculta en chips decorativos. */
  dot?: boolean
  children: React.ReactNode
  className?: string
}

export function Chip({ tone = 'neutral', dot = true, children, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-12 font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden="true" className={cn('block size-[7px] rounded-sm', DOT_CLASSES[tone])} />
      ) : null}
      {children}
    </span>
  )
}

/** Etiqueta descriptiva sin carga de estado: ciudad, modalidad, cupos. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-full bg-soft px-2.5 text-12 text-inkBody',
        className,
      )}
    >
      {children}
    </span>
  )
}
