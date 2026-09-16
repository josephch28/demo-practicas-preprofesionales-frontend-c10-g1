import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { type Offer, listOffers } from '@/api/offers'
import { FilterTabs } from '@/components/FilterTabs'
import { OfferCard, OfferGrid } from '@/components/OfferCard'
import { PageHeader } from '@/components/PageHeader'
import { AsyncSection, EmptyState } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { parseLocalDate } from '@/lib/date'
import { plural } from '@/lib/utils'

const ALL_MODALITIES = 'TODAS'

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  return `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
}

interface ToolbarProps {
  modalities: string[]
  value: string
  onChange: (value: string) => void
  count: number
}

function OffersToolbar({ modalities, value, onChange, count }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterTabs
        label="Filtrar por modalidad"
        value={value}
        onChange={onChange}
        options={[
          { value: ALL_MODALITIES, label: 'Todas' },
          ...modalities.map((modality) => ({ value: modality, label: modality })),
        ]}
      />
      <span className="ml-auto font-data text-12 text-inkSoft">
        {plural(count, 'oferta abierta', 'ofertas abiertas')}
      </span>
    </div>
  )
}

function OffersList({ offers }: { offers: Offer[] }) {
  return (
    <OfferGrid>
      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          title={offer.title}
          subtitle={offer.company.name}
          tags={[
            offer.modality,
            plural(offer.seats, 'cupo', 'cupos'),
            `${offer.requiredHours} h`,
          ]}
          description={offer.description}
          meta={formatPeriod(offer.periodStart, offer.periodEnd)}
          actions={
            <Button asChild size="sm">
              <Link to={`/ofertas/${offer.id}`}>Ver y postular</Link>
            </Button>
          }
        />
      ))}
    </OfferGrid>
  )
}

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [modalityFilter, setModalityFilter] = useState(ALL_MODALITIES)

  useEffect(() => {
    let cancelled = false
    setError(null)
    listOffers()
      .then((data) => {
        if (!cancelled) setOffers(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ofertas')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const modalities = useMemo(() => {
    if (!offers) return []
    return Array.from(new Set(offers.map((offer) => offer.modality))).sort()
  }, [offers])

  const visibleOffers = useMemo(() => {
    if (!offers) return undefined
    if (modalityFilter === ALL_MODALITIES) return offers
    return offers.filter((offer) => offer.modality === modalityFilter)
  }, [offers, modalityFilter])

  return (
    <>
      <PageHeader
        title="Ofertas de práctica"
        subtitle="Publicadas por empresas con convenio y aprobadas por la coordinación."
      />

      {modalities.length > 0 ? (
        <OffersToolbar
          modalities={modalities}
          value={modalityFilter}
          onChange={setModalityFilter}
          count={visibleOffers?.length ?? 0}
        />
      ) : null}

      <AsyncSection
        error={error}
        data={visibleOffers}
        loadingLabel="Cargando ofertas…"
        empty={
          <EmptyState
            title="No hay ofertas publicadas para este periodo"
            description="Vuelve a revisar más adelante."
          />
        }
      >
        {(items) => <OffersList offers={items} />}
      </AsyncSection>
    </>
  )
}
