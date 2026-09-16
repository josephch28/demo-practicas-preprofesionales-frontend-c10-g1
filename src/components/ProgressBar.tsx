import { cn } from '@/lib/utils'

interface ProgressBarProps {
  /** Porcentaje resuelto: se pinta en el color primario. */
  value: number
  /** Porcentaje en trámite: se pinta detrás del anterior, en ámbar. */
  pendingValue?: number
  label: string
  /** `sm` es la barra que va dentro de una fila de tabla. */
  size?: 'sm' | 'md'
  /** Sobre fondos teñidos el canal tiene que ser blanco para verse. */
  onTint?: boolean
  className?: string
}

export function ProgressBar({
  value,
  pendingValue = 0,
  label,
  size = 'md',
  onTint = false,
  className,
}: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'flex w-full overflow-hidden rounded-full',
        size === 'sm' ? 'h-[5px]' : 'h-2',
        onTint ? 'bg-surface' : 'bg-paperRule',
        className,
      )}
    >
      <span className="block h-full bg-stamp" style={{ width: `${value}%` }} />
      <span className="block h-full bg-dotPending" style={{ width: `${pendingValue}%` }} />
    </div>
  )
}
