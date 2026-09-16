import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type Company,
  type CompanyOffer,
  type CreateOfferDto,
  closeOffer,
  createOffer,
  listCompanies,
  listMyOffers,
  publishOffer,
} from '@/api/companies'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { OfferCard, OfferGrid } from '@/components/OfferCard'
import { PageHeader } from '@/components/PageHeader'
import { AsyncSection, EmptyState } from '@/components/Panel'
import { StatCard, StatGrid } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseLocalDate } from '@/lib/date'
import { plural } from '@/lib/utils'

type OfferActionState = 'publishing' | 'closing' | 'published' | 'closed' | null

interface CreateOfferFormState {
  title: string
  description: string
  modality: string
  seats: string
  requiredHours: string
  periodStart: string
  periodEnd: string
}

type CreateOfferFormErrors = Partial<Record<keyof CreateOfferFormState, string>>

const EMPTY_FORM: CreateOfferFormState = {
  title: '',
  description: '',
  modality: '',
  seats: '',
  requiredHours: '',
  periodStart: '',
  periodEnd: '',
}

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  return `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
}

function acceptedCount(offer: CompanyOffer): number {
  return offer.applications.filter((application) => application.status === 'ACCEPTED').length
}

function validateRequiredText(form: CreateOfferFormState): CreateOfferFormErrors {
  const errors: CreateOfferFormErrors = {}
  if (!form.title.trim()) errors.title = 'El título es obligatorio'
  if (!form.description.trim()) errors.description = 'La descripción es obligatoria'
  if (!form.modality.trim()) errors.modality = 'La modalidad es obligatoria'
  return errors
}

function validateSeatsAndHours(form: CreateOfferFormState): CreateOfferFormErrors {
  const errors: CreateOfferFormErrors = {}
  const seatsValue = Number(form.seats)
  if (!form.seats || Number.isNaN(seatsValue) || seatsValue < 1) errors.seats = 'Ingresa al menos 1 cupo'

  const hoursValue = Number(form.requiredHours)
  if (!form.requiredHours || Number.isNaN(hoursValue) || hoursValue < 1) {
    errors.requiredHours = 'Ingresa al menos 1 hora requerida'
  }
  return errors
}

function validatePeriod(form: CreateOfferFormState): CreateOfferFormErrors {
  const errors: CreateOfferFormErrors = {}
  if (!form.periodStart) errors.periodStart = 'La fecha de inicio es obligatoria'
  if (!form.periodEnd) errors.periodEnd = 'La fecha de fin es obligatoria'
  if (form.periodStart && form.periodEnd && form.periodEnd < form.periodStart) {
    errors.periodEnd = 'La fecha de fin debe ser posterior al inicio'
  }
  return errors
}

function validateForm(form: CreateOfferFormState): CreateOfferFormErrors {
  return { ...validateRequiredText(form), ...validateSeatsAndHours(form), ...validatePeriod(form) }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-12 text-void">
      {message}
    </p>
  )
}

function CompanyOffersStats({ offers }: { offers: CompanyOffer[] }) {
  const published = offers.filter((offer) => offer.status === 'PUBLISHED').length
  const drafts = offers.filter((offer) => offer.status === 'DRAFT').length
  const applications = offers.reduce((total, offer) => total + offer.applications.length, 0)

  return (
    <StatGrid>
      <StatCard label="Publicadas" value={String(published)} note="visibles" />
      <StatCard
        label="En borrador"
        value={String(drafts)}
        note="sin publicar"
        noteTone={drafts > 0 ? 'pending' : 'neutral'}
      />
      <StatCard label="Postulaciones" value={String(applications)} note="recibidas" />
    </StatGrid>
  )
}

interface CompanyOfferCardProps {
  offer: CompanyOffer
  state: OfferActionState
  onPublish: (offerId: number) => void
  onClose: (offerId: number) => void
}

function CompanyOfferCard({ offer, state, onPublish, onClose }: CompanyOfferCardProps) {
  const busy = state === 'publishing' || state === 'closing'
  const occupied = acceptedCount(offer)

  return (
    <OfferCard
      title={offer.title}
      subtitle={formatPeriod(offer.periodStart, offer.periodEnd)}
      status={<StatusBadge status={offer.status} />}
      tags={[offer.modality, `${occupied}/${offer.seats} cupos`, `${offer.requiredHours} h`]}
      description={offer.description}
      meta={plural(offer.applications.length, 'postulación', 'postulaciones')}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link to={`/ofertas-empresa/${offer.id}/postulaciones`}>Ver postulaciones</Link>
          </Button>
          {offer.status === 'DRAFT' ? (
            <Button type="button" size="sm" onClick={() => onPublish(offer.id)} disabled={busy}>
              {state === 'publishing' ? 'Publicando…' : 'Publicar'}
            </Button>
          ) : null}
          {offer.status === 'PUBLISHED' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onClose(offer.id)}
              disabled={busy}
            >
              {state === 'closing' ? 'Cerrando…' : 'Cerrar'}
            </Button>
          ) : null}
        </>
      }
    />
  )
}

interface CreateOfferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateOfferFormState
  formErrors: CreateOfferFormErrors
  creating: boolean
  createError: string | null
  onFieldChange: (field: keyof CreateOfferFormState, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function CreateOfferDialog({
  open,
  onOpenChange,
  form,
  formErrors,
  creating,
  createError,
  onFieldChange,
  onSubmit,
}: CreateOfferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar una oferta</DialogTitle>
          <DialogDescription>
            Se crea en borrador — publícala cuando esté lista
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-title">Título de la oferta</Label>
              <Input
                id="offer-title"
                value={form.title}
                onChange={(event) => onFieldChange('title', event.target.value)}
                placeholder="Ej. Asistente de mantenimiento mecánico"
                aria-invalid={Boolean(formErrors.title)}
              />
              <FieldError message={formErrors.title} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-description">¿Qué va a hacer el practicante?</Label>
              <p className="text-12 text-inkSoft">
                Indicá las actividades y quién lo supervisa; es lo que más devuelve la coordinación.
              </p>
              <Textarea
                id="offer-description"
                value={form.description}
                onChange={(event) => onFieldChange('description', event.target.value)}
                rows={3}
                placeholder="Describí las actividades, el horario y quién supervisa"
                aria-invalid={Boolean(formErrors.description)}
              />
              <FieldError message={formErrors.description} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-modality">Modalidad</Label>
              <Input
                id="offer-modality"
                value={form.modality}
                onChange={(event) => onFieldChange('modality', event.target.value)}
                placeholder="PRESENCIAL, HIBRIDA o REMOTA"
                aria-invalid={Boolean(formErrors.modality)}
              />
              <FieldError message={formErrors.modality} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-seats">Cupos</Label>
                <Input
                  id="offer-seats"
                  type="number"
                  min={1}
                  value={form.seats}
                  onChange={(event) => onFieldChange('seats', event.target.value)}
                  className="font-data"
                  aria-invalid={Boolean(formErrors.seats)}
                />
                <FieldError message={formErrors.seats} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-hours">Horas requeridas</Label>
                <Input
                  id="offer-hours"
                  type="number"
                  min={1}
                  value={form.requiredHours}
                  onChange={(event) => onFieldChange('requiredHours', event.target.value)}
                  className="font-data"
                  aria-invalid={Boolean(formErrors.requiredHours)}
                />
                <FieldError message={formErrors.requiredHours} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-period-start">Inicio</Label>
                <Input
                  id="offer-period-start"
                  type="date"
                  value={form.periodStart}
                  onChange={(event) => onFieldChange('periodStart', event.target.value)}
                  className="font-data"
                  aria-invalid={Boolean(formErrors.periodStart)}
                />
                <FieldError message={formErrors.periodStart} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-period-end">Fin</Label>
                <Input
                  id="offer-period-end"
                  type="date"
                  value={form.periodEnd}
                  onChange={(event) => onFieldChange('periodEnd', event.target.value)}
                  className="font-data"
                  aria-invalid={Boolean(formErrors.periodEnd)}
                />
                <FieldError message={formErrors.periodEnd} />
              </div>
            </div>

            {createError ? (
              <p role="alert" className="rounded-md bg-chipVoid px-3 py-2.5 text-13 text-void">
                {createError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear oferta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CompanyOffersPage() {
  const { user } = useAuth()
  const [offers, setOffers] = useState<CompanyOffer[] | undefined>(undefined)
  const [companies, setCompanies] = useState<Company[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const [actionState, setActionState] = useState<Record<number, OfferActionState>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateOfferFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<CreateOfferFormErrors>({})
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function refetchOffers() {
    return listMyOffers()
      .then((data) => setOffers(data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus ofertas'))
  }

  useEffect(() => {
    let cancelled = false
    listMyOffers()
      .then((data) => {
        if (!cancelled) setOffers(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus ofertas')
      })
    listCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(data)
      })
      .catch(() => {
        // La empresa es solo un dato de contexto en el encabezado: si falla,
        // se omite en vez de bloquear el resto de la pantalla.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const myCompany = companies?.find((company) => company.id === user?.companyId)

  async function handlePublish(offerId: number) {
    setActionError(null)
    setActionState((prev) => ({ ...prev, [offerId]: 'publishing' }))
    try {
      await publishOffer(offerId)
      await refetchOffers()
      setActionState((prev) => ({ ...prev, [offerId]: 'published' }))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo publicar la oferta')
      setActionState((prev) => ({ ...prev, [offerId]: null }))
    }
  }

  async function handleClose(offerId: number) {
    setActionError(null)
    setActionState((prev) => ({ ...prev, [offerId]: 'closing' }))
    try {
      await closeOffer(offerId)
      await refetchOffers()
      setActionState((prev) => ({ ...prev, [offerId]: 'closed' }))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cerrar la oferta')
      setActionState((prev) => ({ ...prev, [offerId]: null }))
    }
  }

  function openDialog() {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setCreateError(null)
    setDialogOpen(true)
  }

  function handleFieldChange(field: keyof CreateOfferFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)

    if (!user?.companyId) {
      setCreateError('Tu usuario no tiene una empresa asociada')
      return
    }

    const nextErrors = validateForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const dto: CreateOfferDto = {
      companyId: user.companyId,
      title: form.title.trim(),
      description: form.description.trim(),
      modality: form.modality.trim(),
      seats: Number(form.seats),
      requiredHours: Number(form.requiredHours),
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
    }

    setCreating(true)
    try {
      await createOffer(dto)
      await refetchOffers()
      setDialogOpen(false)
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear la oferta')
    } finally {
      setCreating(false)
    }
  }

  const intro = 'Publicá una vacante y recibí postulaciones de estudiantes.'

  return (
    <>
      <PageHeader
        title="Mis ofertas"
        subtitle={myCompany ? `${myCompany.name} · ${intro}` : intro}
        actions={
          <Button type="button" onClick={openDialog}>
            Publicar oferta
          </Button>
        }
      />

      {offers ? <CompanyOffersStats offers={offers} /> : null}

      {actionError ? (
        <p role="alert" className="rounded-lg bg-chipVoid px-4 py-3 text-13 text-void">
          {actionError}
        </p>
      ) : null}

      <AsyncSection
        error={error}
        data={offers}
        loadingLabel="Cargando ofertas…"
        empty={
          <EmptyState
            title="Todavía no has publicado ofertas"
            description="Publicá una vacante para que los estudiantes puedan postular."
            action={
              <Button type="button" size="sm" onClick={openDialog}>
                Publicar oferta
              </Button>
            }
          />
        }
      >
        {(items) => (
          <OfferGrid>
            {items.map((offer) => (
              <CompanyOfferCard
                key={offer.id}
                offer={offer}
                state={actionState[offer.id] ?? null}
                onPublish={handlePublish}
                onClose={handleClose}
              />
            ))}
          </OfferGrid>
        )}
      </AsyncSection>

      <CreateOfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        formErrors={formErrors}
        creating={creating}
        createError={createError}
        onFieldChange={handleFieldChange}
        onSubmit={handleCreate}
      />
    </>
  )
}
