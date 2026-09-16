import type { ReactNode } from 'react'
import { Tag } from '@/components/Chip'

interface OfferCardProps {
  title: ReactNode
  /** Segunda línea del encabezado: la empresa, o la modalidad si ya se sabe. */
  subtitle?: ReactNode
  /** Chip de estado, arriba a la derecha. */
  status?: ReactNode
  tags?: string[]
  description?: ReactNode
  /** Dato del pie, alineado a la izquierda: cupos, postulaciones, periodo. */
  meta?: ReactNode
  actions?: ReactNode
}

/** Tarjeta de oferta del marketplace: cabecera, etiquetas, texto y pie con acciones. */
export function OfferCard({
  title,
  subtitle,
  status,
  tags,
  description,
  meta,
  actions,
}: OfferCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-surface px-5 py-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-16 font-bold leading-snug text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-13 text-inkMid">{subtitle}</p> : null}
        </div>
        {status ? <div className="flex-none">{status}</div> : null}
      </div>

      {tags && tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}

      {description ? (
        <p className="line-clamp-3 text-13 leading-relaxed text-inkDeep">{description}</p>
      ) : null}

      {meta || actions ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-paperRule pt-3">
          <span className="font-data text-12 text-inkSoft">{meta}</span>
          {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  )
}

/** Rejilla de tarjetas de oferta. */
export function OfferGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">{children}</div>
  )
}
