import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ApiError, api } from '@/api/client'
import { Chip } from '@/components/Chip'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Section } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseLocalDate } from '@/lib/date'
import { plural } from '@/lib/utils'
import { db, type LocalDocument } from '@/offline/db'
import { usePlacement } from '@/offline/hooks/usePlacement'

type DocumentKind = 'AGREEMENT' | 'INSURANCE' | 'REPORT' | 'EVIDENCE'

// Espejo de REQUIRED_DOCS en el backend (placement.service.ts): estos dos son
// los únicos que bloquean la activación de la práctica.
const REQUIRED_KINDS: DocumentKind[] = ['AGREEMENT', 'INSURANCE']

const KIND_LABEL: Record<DocumentKind, string> = {
  AGREEMENT: 'Convenio',
  INSURANCE: 'Seguro',
  REPORT: 'Informe',
  EVIDENCE: 'Evidencia',
}

const DOC_ROW_CLASS = 'flex min-h-row items-center justify-between gap-4 px-[18px] py-2.5'

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

/** Último estado conocido de un tipo de documento, o `null` si no se subió. */
function latestStatus(documents: LocalDocument[], kind: DocumentKind): string | null {
  return (
    documents
      .filter((doc) => doc.kind === kind)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]?.status ?? null
  )
}

function RequiredStatus({ documents, kind }: { documents: LocalDocument[] | undefined; kind: DocumentKind }) {
  if (documents === undefined) return <span className="text-12 text-inkSoft">Cargando…</span>
  const status = latestStatus(documents, kind)
  if (status) return <StatusBadge status={status} />
  return <Chip tone="void">Falta subir</Chip>
}

function RequiredDocuments({ documents }: { documents: LocalDocument[] | undefined }) {
  return (
    <Section title="Obligatorios para activar la práctica">
      <div className="divide-y divide-paperRule">
        {REQUIRED_KINDS.map((kind) => (
          <div key={kind} className={DOC_ROW_CLASS}>
            <span className="text-14 font-semibold text-ink">{KIND_LABEL[kind]}</span>
            <RequiredStatus documents={documents} kind={kind} />
          </div>
        ))}
      </div>
    </Section>
  )
}

function DocumentsList({ documents }: { documents: LocalDocument[] | undefined }) {
  if (documents === undefined) {
    return (
      <Section title="Todos tus documentos">
        <LoadingState>Cargando documentos…</LoadingState>
      </Section>
    )
  }

  if (documents.length === 0) {
    return (
      <Section title="Todos tus documentos">
        <EmptyState
          title="Todavía no has subido documentos"
          description="Empieza por el convenio y el seguro."
        />
      </Section>
    )
  }

  return (
    <Section
      title="Todos tus documentos"
      aside={
        <span className="font-data text-12 text-inkSoft">
          {plural(documents.length, 'documento', 'documentos')}
        </span>
      }
    >
      <div className="divide-y divide-paperRule">
        {documents.map((doc, index) => (
          <div key={index} className={DOC_ROW_CLASS}>
            <div className="min-w-0">
              <div className="truncate text-14 font-semibold text-ink">{doc.filename}</div>
              <div className="mt-0.5 text-12 text-inkSoft">
                {KIND_LABEL[doc.kind as DocumentKind] ?? doc.kind} ·{' '}
                <span className="font-data">{formatDate(doc.updatedAt)}</span>
              </div>
            </div>
            <StatusBadge status={doc.status} />
          </div>
        ))}
      </div>
    </Section>
  )
}

export function DocumentsPage() {
  const placement = usePlacement()
  const documents = useLiveQuery<LocalDocument[] | undefined>(async () => {
    if (!placement) return undefined
    return db.documents.where('placementId').equals(placement.id).toArray()
  }, [placement?.id])

  const [kind, setKind] = useState<DocumentKind>('AGREEMENT')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (placement === undefined) {
    return <LoadingState>Cargando tu práctica…</LoadingState>
  }

  if (placement === null) {
    return (
      <EmptyState
        title="No tienes una práctica activa todavía"
        description="Cuando la coordinación active tu plaza, vas a poder subir documentos."
      />
    )
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUploadError(null)

    if (!file) {
      setUploadError('Selecciona un archivo')
      return
    }

    setUploading(true)
    try {
      const created = await api<LocalDocument>(`/placements/${placement!.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          // No hay almacenamiento de archivos real en este template: es un
          // identificador de referencia, no una URL donde recuperar el
          // archivo. Cada equipo conecta su propio storage sobre este campo.
          storageKey: crypto.randomUUID(),
        }),
      })
      await db.documents.put(created)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'No se pudo subir el documento')
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="A diferencia del libro de horas, subir un documento necesita conexión."
      />

      <RequiredDocuments documents={documents} />

      <Section title="Subir documento">
        <form className="flex flex-col gap-4 px-[18px] py-4" onSubmit={handleUpload} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document-kind">Tipo de documento</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as DocumentKind)}>
                <SelectTrigger id="document-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as DocumentKind[]).map((kindOption) => (
                    <SelectItem key={kindOption} value={kindOption}>
                      {KIND_LABEL[kindOption]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document-file">Archivo</Label>
              <input
                id="document-file"
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="flex h-field w-full items-center rounded border border-line bg-surface px-[13px] text-13 text-inkBody file:mr-3 file:h-7 file:rounded-md file:border file:border-line file:bg-soft file:px-3 file:font-display file:text-13 file:font-medium file:text-ink"
              />
            </div>
          </div>

          {uploadError ? (
            <p role="alert" className="rounded-md bg-chipVoid px-3 py-2.5 text-13 text-void">
              {uploadError}
            </p>
          ) : null}

          <Button type="submit" disabled={uploading} className="self-start">
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </Button>
        </form>
      </Section>

      <DocumentsList documents={documents} />
    </>
  )
}
