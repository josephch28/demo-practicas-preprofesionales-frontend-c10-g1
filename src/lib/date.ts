/** Parsea una fecha ISO como fecha local, no como medianoche UTC. */
export function parseLocalDate(value: string): Date {
  const [datePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatShortDate(value: string): string {
  const parsed = parseLocalDate(value)
  if (Number.isNaN(parsed.getTime())) return value
  return SHORT_DATE_FORMAT.format(parsed)
}