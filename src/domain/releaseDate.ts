import type { ReleaseDate } from './types'

/** How precisely a release date is known. */
export type DatePrecision = 'tba' | 'year' | 'quarter' | 'month' | 'day'

export interface ReleaseDateParts {
  precision: DatePrecision
  year?: number
  /** 1..4 */
  quarter?: number
  /** 1..12 */
  month?: number
  /** 1..31 */
  day?: number
}

export const DATE_PRECISIONS: readonly { value: DatePrecision; label: string }[] = [
  { value: 'day', label: 'Exact date' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'tba', label: 'TBA' },
]

export const MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3))

export const MIN_YEAR = 1970
export const MAX_YEAR = 2100

/** Smaller = more precise. Breaks ties between dates that end on the same day. */
const PRECISION_RANK: Record<DatePrecision, number> = {
  day: 0,
  month: 1,
  quarter: 2,
  year: 3,
  tba: 4,
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function validYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
}

/** Parses the stored string. Returns null for malformed input. */
export function parseReleaseDate(value: ReleaseDate): ReleaseDateParts | null {
  const s = value.trim()
  if (s === '') return { precision: 'tba' }

  let m = /^(\d{4})$/.exec(s)
  if (m) {
    const year = Number(m[1])
    return validYear(year) ? { precision: 'year', year } : null
  }

  m = /^(\d{4})-Q([1-4])$/.exec(s)
  if (m) {
    const year = Number(m[1])
    return validYear(year) ? { precision: 'quarter', year, quarter: Number(m[2]) } : null
  }

  m = /^(\d{4})-(\d{2})$/.exec(s)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    return validYear(year) && month >= 1 && month <= 12
      ? { precision: 'month', year, month }
      : null
  }

  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    if (!validYear(year) || month < 1 || month > 12) return null
    if (day < 1 || day > daysInMonth(year, month)) return null
    return { precision: 'day', year, month, day }
  }

  return null
}

export function isValidReleaseDate(value: ReleaseDate): boolean {
  return parseReleaseDate(value) !== null
}

/** Builds the stored string from parts. Returns null when the parts are incomplete or invalid. */
export function buildReleaseDate(parts: ReleaseDateParts): ReleaseDate | null {
  const { precision, year, quarter, month, day } = parts
  let result: string
  switch (precision) {
    case 'tba':
      return ''
    case 'year':
      if (year === undefined) return null
      result = pad(year, 4)
      break
    case 'quarter':
      if (year === undefined || quarter === undefined) return null
      result = `${pad(year, 4)}-Q${quarter}`
      break
    case 'month':
      if (year === undefined || month === undefined) return null
      result = `${pad(year, 4)}-${pad(month)}`
      break
    case 'day':
      if (year === undefined || month === undefined || day === undefined) return null
      result = `${pad(year, 4)}-${pad(month)}-${pad(day)}`
      break
  }
  return parseReleaseDate(result) ? result : null
}

/** Human-readable form: "TBA", "2027", "Q3 2027", "Mar 2027", "Mar 27, 2027". */
export function formatReleaseDate(value: ReleaseDate): string {
  const p = parseReleaseDate(value)
  if (!p) return value.trim() || 'TBA'
  switch (p.precision) {
    case 'tba':
      return 'TBA'
    case 'year':
      return String(p.year)
    case 'quarter':
      return `Q${p.quarter} ${p.year}`
    case 'month':
      return `${SHORT_MONTHS[p.month! - 1]} ${p.year}`
    case 'day':
      return `${SHORT_MONTHS[p.month! - 1]} ${p.day}, ${p.year}`
  }
}

/** First and last day ('YYYY-MM-DD') the date could fall on, or null for TBA / invalid. */
export function releaseDateRange(value: ReleaseDate): { start: string; end: string } | null {
  const p = parseReleaseDate(value)
  if (!p || p.precision === 'tba') return null
  const y = pad(p.year!, 4)
  switch (p.precision) {
    case 'year':
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    case 'quarter': {
      const firstMonth = (p.quarter! - 1) * 3 + 1
      const lastMonth = firstMonth + 2
      return {
        start: `${y}-${pad(firstMonth)}-01`,
        end: `${y}-${pad(lastMonth)}-${pad(daysInMonth(p.year!, lastMonth))}`,
      }
    }
    case 'month':
      return {
        start: `${y}-${pad(p.month!)}-01`,
        end: `${y}-${pad(p.month!)}-${pad(daysInMonth(p.year!, p.month!))}`,
      }
    case 'day': {
      const d = `${y}-${pad(p.month!)}-${pad(p.day!)}`
      return { start: d, end: d }
    }
  }
}

export function releasePrecision(value: ReleaseDate): DatePrecision | null {
  return parseReleaseDate(value)?.precision ?? null
}

/**
 * Sort key: dates sort by the last day they could fall on, so "2027" sorts after every
 * specific 2027 date; ties go to the more precise date. TBA and invalid dates return null
 * (callers place them last).
 */
export function releaseSortKey(value: ReleaseDate): string | null {
  const p = parseReleaseDate(value)
  const range = releaseDateRange(value)
  if (!p || !range) return null
  return `${range.end}#${PRECISION_RANK[p.precision]}`
}

/** Today's date in local time as 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Adds days to a 'YYYY-MM-DD' date. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Whole days from `today` to an exact release date; null unless the date is exact. */
export function daysUntil(value: ReleaseDate, today: string): number | null {
  const p = parseReleaseDate(value)
  if (!p || p.precision !== 'day') return null
  const [ty, tm, td] = today.split('-').map(Number)
  const from = Date.UTC(ty, tm - 1, td)
  const to = Date.UTC(p.year!, p.month! - 1, p.day!)
  return Math.round((to - from) / 86_400_000)
}

/** Short countdown text for exact dates: "Today", "Tomorrow", "in 12 days". */
export function countdownLabel(value: ReleaseDate, today: string): string | null {
  const days = daysUntil(value, today)
  if (days === null || days < 0) return null
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}
