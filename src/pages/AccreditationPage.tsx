import { useEffect, useState } from 'react'
import { type AccreditationRow, reportForPeriod } from '@/api/accreditation'
import { ApiError } from '@/api/client'
import { FilterTabs } from '@/components/FilterTabs'
import { PageHeader } from '@/components/PageHeader'
import { AsyncSection, EmptyState, Panel, TableHeaderRow, rowClass } from '@/components/Panel'
import { ProgressBar } from '@/components/ProgressBar'
import { StatCard, StatGrid } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Ledger } from '@/components/ledger/Ledger'
import { plural } from '@/lib/utils'

// El backend exige `period` con formato AAAA-1/AAAA-2 (ver AccreditationQueryDto);
// el selector nunca debe poder mandar un valor vacío, así que se restringe a
// estas dos opciones fijas del periodo académico vigente.
const PERIODS = ['2026-1', '2026-2'] as const

function ColumnHeader() {
  return (
    <TableHeaderRow>
      <span className="w-40">Estudiante</span>
      <span className="w-44">Nivel</span>
      <span className="w-44">Avance</span>
      <span className="flex-1">Razones</span>
    </TableHeaderRow>
  )
}

function AccreditationStats({ rows }: { rows: AccreditationRow[] }) {
  const accredited = rows.filter((row) => row.level === 'ACREDITADO').length
  const notAccredited = rows.filter((row) => row.level === 'NO_ACREDITADO').length

  return (
    <StatGrid>
      <StatCard label="Practicantes" value={String(rows.length)} note="en el periodo" />
      <StatCard
        label="Acreditados"
        value={String(accredited)}
        note={`de ${rows.length}`}
        noteTone="stamp"
      />
      <StatCard
        label="No acreditados"
        value={String(notAccredited)}
        note="requieren revisión"
        noteTone={notAccredited > 0 ? 'void' : 'neutral'}
      />
    </StatGrid>
  )
}

function AccreditationRowItem({ row }: { row: AccreditationRow }) {
  return (
    <div className={rowClass}>
      <span className="text-14 font-semibold text-ink sm:w-40">{row.studentName}</span>
      <span className="sm:w-44">
        <StatusBadge status={row.level} />
      </span>
      <span className="flex items-center gap-2.5 sm:w-44">
        <ProgressBar
          size="sm"
          value={row.completionPercentage}
          label={`Avance de ${row.studentName}`}
          className="flex-1"
        />
        <span className="font-data text-12 text-inkSoft">{row.completionPercentage}%</span>
      </span>
      <span className="flex-1 text-13 text-inkSoft">
        {row.reasons.length > 0 ? row.reasons.join(' · ') : '—'}
      </span>
    </div>
  )
}

/** Acta de acreditación por periodo académico. No sincronizable: siempre requiere red. */
export function AccreditationPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[0])
  const [rows, setRows] = useState<AccreditationRow[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(undefined)
    setError(null)
    reportForPeriod(period)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudo generar el acta')
      })
    return () => {
      cancelled = true
    }
  }, [period])

  return (
    <>
      <PageHeader
        title="Acreditación"
        subtitle="El acta del periodo: quién cierra su práctica y quién todavía no."
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs
          label="Periodo académico"
          value={period}
          onChange={(value) => setPeriod(value as (typeof PERIODS)[number])}
          options={PERIODS.map((option) => ({ value: option, label: option }))}
        />
        {rows ? (
          <span className="ml-auto font-data text-12 text-inkSoft">
            {plural(rows.length, 'practicante', 'practicantes')}
          </span>
        ) : null}
      </div>

      {rows ? <AccreditationStats rows={rows} /> : null}

      <AsyncSection
        error={error}
        data={rows}
        loadingLabel="Generando acta…"
        empty={
          <EmptyState
            title="No hay placements en este periodo"
            description="Probá con el otro periodo académico."
          />
        }
      >
        {(items) => (
          <Panel>
            <Ledger header={<ColumnHeader />}>
              {items.map((row) => (
                <AccreditationRowItem key={row.placementId} row={row} />
              ))}
            </Ledger>
          </Panel>
        )}
      </AsyncSection>
    </>
  )
}
