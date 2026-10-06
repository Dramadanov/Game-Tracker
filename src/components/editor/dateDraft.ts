import {
  MAX_YEAR,
  MIN_YEAR,
  buildReleaseDate,
  parseReleaseDate,
  type DatePrecision,
} from '../../domain/releaseDate'

/**
 * What the release-date controls hold while editing. Unlike the stored string it can be
 * incomplete (e.g. "Month" picked but no year typed yet), so every part is kept as text.
 */
export interface DateDraft {
  precision: DatePrecision
  /** Typed year, e.g. '2027'. */
  year: string
  /** '' or '1'..'4'. */
  quarter: string
  /** '' or '1'..'12'. */
  month: string
  /** 'YYYY-MM-DD' from the date input, or ''. */
  date: string
}

/** Which control a date problem belongs to (gets aria-invalid and focus). */
export type DatePart = 'day' | 'year' | 'quarter' | 'month'

export interface ResolvedDate {
  /** The stored form ('' = TBA), or null while incomplete/invalid. */
  value: string | null
  error: string | null
  part: DatePart | null
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const quarterOf = (month: number) => Math.ceil(month / 3)
const firstMonthOf = (quarter: number) => (quarter - 1) * 3 + 1

export function parseYear(text: string): number | null {
  if (!/^\d{4}$/.test(text.trim())) return null
  const year = Number(text)
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null
}

export function dateDraftFrom(value: string): DateDraft {
  const draft: DateDraft = { precision: 'tba', year: '', quarter: '', month: '', date: '' }
  const p = parseReleaseDate(value)
  if (!p) return draft
  draft.precision = p.precision
  if (p.year !== undefined) draft.year = String(p.year)
  if (p.quarter !== undefined) draft.quarter = String(p.quarter)
  if (p.month !== undefined) {
    draft.month = String(p.month)
    draft.quarter = String(quarterOf(p.month))
  }
  if (p.precision === 'day') draft.date = value.trim()
  return draft
}

/**
 * Changes precision while keeping what is already known: the year always, the month or
 * quarter where they can be derived. Going to "Exact date" starts at the first day of the
 * known range (the date input cannot hold a partial date) unless an earlier exact date fits.
 */
export function switchPrecision(draft: DateDraft, next: DatePrecision): DateDraft {
  if (next === draft.precision) return draft
  let { year, quarter, month } = draft

  if (draft.precision === 'day') {
    const p = parseReleaseDate(draft.date)
    if (p?.precision === 'day') {
      year = String(p.year)
      month = String(p.month)
      quarter = String(quarterOf(p.month!))
    }
  } else if (draft.precision === 'month' && month) {
    quarter = String(quarterOf(Number(month)))
  } else if (draft.precision === 'quarter' && quarter && month && quarterOf(Number(month)) !== Number(quarter)) {
    // The quarter changed since a month was known; that month no longer applies.
    month = ''
  }

  if ((next === 'month' || next === 'day') && !month && quarter) {
    month = String(firstMonthOf(Number(quarter)))
  }

  let date = draft.date
  if (next === 'day') {
    const y = parseYear(year)
    const previous = parseReleaseDate(date)
    const fits =
      previous?.precision === 'day' &&
      previous.year === y &&
      (!month || previous.month === Number(month))
    if (!fits) date = y !== null ? `${y}-${pad2(month ? Number(month) : 1)}-01` : ''
  }

  return { precision: next, year, quarter, month, date }
}

/** Turns the controls into the stored string, or explains what is missing. */
export function resolveDateDraft(draft: DateDraft): ResolvedDate {
  const fail = (error: string, part: DatePart): ResolvedDate => ({ value: null, error, part })
  const yearRange = `Enter a year between ${MIN_YEAR} and ${MAX_YEAR}.`

  switch (draft.precision) {
    case 'tba':
      return { value: '', error: null, part: null }
    case 'day': {
      if (!draft.date) return fail('Pick a date.', 'day')
      const p = parseReleaseDate(draft.date)
      if (p?.precision !== 'day') return fail(`Pick a date between ${MIN_YEAR} and ${MAX_YEAR}.`, 'day')
      return { value: draft.date, error: null, part: null }
    }
    case 'month':
      if (!draft.month) return fail('Pick a month.', 'month')
      break
    case 'quarter':
      if (!draft.quarter) return fail('Pick a quarter.', 'quarter')
      break
    case 'year':
      break
  }

  if (!draft.year.trim()) return fail('Enter a year.', 'year')
  const year = parseYear(draft.year)
  if (year === null) return fail(yearRange, 'year')
  const value = buildReleaseDate({
    precision: draft.precision,
    year,
    quarter: draft.quarter ? Number(draft.quarter) : undefined,
    month: draft.month ? Number(draft.month) : undefined,
  })
  return value === null ? fail('That date is not valid.', 'year') : { value, error: null, part: null }
}
