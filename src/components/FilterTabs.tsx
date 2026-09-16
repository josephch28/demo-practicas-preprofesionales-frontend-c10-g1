import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

interface FilterTabsProps {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  /** Etiqueta del grupo para lectores de pantalla. */
  label: string
  /** `well` es la variante para cuando el grupo va sobre una superficie blanca. */
  surface?: 'surface' | 'well'
  className?: string
}

/** Grupo segmentado de filtros: sustituye al desplegable cuando hay pocas opciones. */
export function FilterTabs({
  options,
  value,
  onChange,
  label,
  surface = 'surface',
  className,
}: FilterTabsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex flex-wrap gap-0.5 rounded-lg p-0.5',
        surface === 'surface' ? 'bg-surface' : 'bg-soft',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-[30px] items-center rounded-md px-3 text-13 transition-colors',
              active
                ? 'bg-stamp font-semibold text-surface'
                : 'text-inkMid hover:bg-pillHover hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
