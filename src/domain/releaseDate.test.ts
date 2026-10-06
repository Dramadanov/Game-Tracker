import { describe, expect, it } from 'vitest'
import {
  MAX_YEAR,
  MIN_YEAR,
  addDays,
  buildReleaseDate,
  countdownLabel,
  daysUntil,
  formatReleaseDate,
  isValidReleaseDate,
  parseReleaseDate,
  releaseDateRange,
  releasePrecision,
  releaseSortKey,
  todayISO,
} from './releaseDate'

describe('parseReleaseDate', () => {
  it('parses every precision', () => {
    expect(parseReleaseDate('')).toEqual({ precision: 'tba' })
    expect(parseReleaseDate('2027')).toEqual({ precision: 'year', year: 2027 })
    expect(parseReleaseDate('2027-Q3')).toEqual({ precision: 'quarter', year: 2027, quarter: 3 })
    expect(parseReleaseDate('2027-03')).toEqual({ precision: 'month', year: 2027, month: 3 })
    expect(parseReleaseDate('2027-03-27')).toEqual({ precision: 'day', year: 2027, month: 3, day: 27 })
  })

  it('treats whitespace-only input as TBA and ignores surrounding whitespace', () => {
    expect(parseReleaseDate('   ')).toEqual({ precision: 'tba' })
    expect(parseReleaseDate('\t2027-Q1\n')).toEqual({ precision: 'quarter', year: 2027, quarter: 1 })
    expect(parseReleaseDate(' 2027-12-31 ')).toEqual({ precision: 'day', year: 2027, month: 12, day: 31 })
  })

  it('accepts every quarter and month', () => {
    for (const q of [1, 2, 3, 4]) expect(parseReleaseDate(`2030-Q${q}`)?.quarter).toBe(q)
    for (let m = 1; m <= 12; m++) {
      expect(parseReleaseDate(`2030-${String(m).padStart(2, '0')}`)?.month).toBe(m)
    }
  })

  it('handles leap years', () => {
    expect(parseReleaseDate('2028-02-29')).toEqual({ precision: 'day', year: 2028, month: 2, day: 29 })
    expect(parseReleaseDate('2000-02-29')).not.toBeNull() // divisible by 400
    expect(parseReleaseDate('2027-02-29')).toBeNull()
    expect(parseReleaseDate('2100-02-29')).toBeNull() // divisible by 100, not 400
  })

  it('checks the number of days in each month', () => {
    expect(parseReleaseDate('2027-04-30')).not.toBeNull()
    expect(parseReleaseDate('2027-04-31')).toBeNull()
    expect(parseReleaseDate('2027-01-31')).not.toBeNull()
    expect(parseReleaseDate('2027-02-28')).not.toBeNull()
    expect(parseReleaseDate('2027-02-30')).toBeNull()
    expect(parseReleaseDate('2027-02-31')).toBeNull()
  })

  it.each([
    ['month 13', '2027-13'],
    ['month 00', '2027-00'],
    ['day 13th month', '2027-13-01'],
    ['day 00', '2027-03-00'],
    ['day 32', '2027-01-32'],
    ['Feb 30', '2027-02-30'],
    ['Q0', '2027-Q0'],
    ['Q5', '2027-Q5'],
    ['lower-case quarter', '2027-q1'],
    ['year below range', String(MIN_YEAR - 1)],
    ['year above range', String(MAX_YEAR + 1)],
    ['year 0000', '0000'],
    ['two-digit year', '27'],
    ['five-digit year', '20270'],
    ['single-digit month', '2027-3'],
    ['single-digit day', '2027-03-5'],
    ['slashes', '2027/03/05'],
    ['ISO timestamp', '2027-03-05T00:00:00Z'],
    ['inner whitespace', '2027 -03'],
    ['words', 'soon'],
    ['TBA text', 'TBA'],
    ['negative year', '-2027'],
    ['quarter with month', '2027-Q1-01'],
  ])('rejects %s (%j)', (_label, value) => {
    expect(parseReleaseDate(value)).toBeNull()
    expect(isValidReleaseDate(value)).toBe(false)
  })

  it('accepts the boundary years', () => {
    expect(parseReleaseDate(String(MIN_YEAR))).toEqual({ precision: 'year', year: MIN_YEAR })
    expect(parseReleaseDate(String(MAX_YEAR))).toEqual({ precision: 'year', year: MAX_YEAR })
    expect(parseReleaseDate(`${MAX_YEAR}-12-31`)).not.toBeNull()
    expect(parseReleaseDate(`${MIN_YEAR}-01-01`)).not.toBeNull()
  })
})

describe('releasePrecision / isValidReleaseDate', () => {
  it('returns the precision or null', () => {
    expect(releasePrecision('')).toBe('tba')
    expect(releasePrecision('2027')).toBe('year')
    expect(releasePrecision('2027-Q2')).toBe('quarter')
    expect(releasePrecision('2027-02')).toBe('month')
    expect(releasePrecision('2027-02-01')).toBe('day')
    expect(releasePrecision('nope')).toBeNull()
    expect(isValidReleaseDate('')).toBe(true)
  })
})

describe('buildReleaseDate', () => {
  it('builds every precision', () => {
    expect(buildReleaseDate({ precision: 'tba' })).toBe('')
    expect(buildReleaseDate({ precision: 'tba', year: 2027, month: 5 })).toBe('')
    expect(buildReleaseDate({ precision: 'year', year: 2027 })).toBe('2027')
    expect(buildReleaseDate({ precision: 'quarter', year: 2027, quarter: 4 })).toBe('2027-Q4')
    expect(buildReleaseDate({ precision: 'month', year: 2027, month: 3 })).toBe('2027-03')
    expect(buildReleaseDate({ precision: 'day', year: 2027, month: 3, day: 5 })).toBe('2027-03-05')
  })

  it('ignores parts the precision does not use', () => {
    expect(buildReleaseDate({ precision: 'year', year: 2027, month: 4, day: 9 })).toBe('2027')
    expect(buildReleaseDate({ precision: 'month', year: 2027, month: 4, day: 99 })).toBe('2027-04')
  })

  it('returns null for incomplete parts', () => {
    expect(buildReleaseDate({ precision: 'year' })).toBeNull()
    expect(buildReleaseDate({ precision: 'quarter', year: 2027 })).toBeNull()
    expect(buildReleaseDate({ precision: 'quarter', quarter: 2 })).toBeNull()
    expect(buildReleaseDate({ precision: 'month', year: 2027 })).toBeNull()
    expect(buildReleaseDate({ precision: 'day', year: 2027, month: 3 })).toBeNull()
    expect(buildReleaseDate({ precision: 'day', month: 3, day: 1 })).toBeNull()
  })

  it('returns null for invalid parts', () => {
    expect(buildReleaseDate({ precision: 'day', year: 2027, month: 2, day: 30 })).toBeNull()
    expect(buildReleaseDate({ precision: 'day', year: 2027, month: 2, day: 29 })).toBeNull()
    expect(buildReleaseDate({ precision: 'day', year: 2028, month: 2, day: 29 })).toBe('2028-02-29')
    expect(buildReleaseDate({ precision: 'month', year: 2027, month: 13 })).toBeNull()
    expect(buildReleaseDate({ precision: 'month', year: 2027, month: 0 })).toBeNull()
    expect(buildReleaseDate({ precision: 'quarter', year: 2027, quarter: 5 })).toBeNull()
    expect(buildReleaseDate({ precision: 'quarter', year: 2027, quarter: 0 })).toBeNull()
    expect(buildReleaseDate({ precision: 'year', year: 1969 })).toBeNull()
    expect(buildReleaseDate({ precision: 'year', year: 2101 })).toBeNull()
    expect(buildReleaseDate({ precision: 'year', year: 99 })).toBeNull()
    expect(buildReleaseDate({ precision: 'year', year: -5 })).toBeNull()
    expect(buildReleaseDate({ precision: 'year', year: 2027.5 })).toBeNull()
    expect(buildReleaseDate({ precision: 'year', year: Number.NaN })).toBeNull()
    expect(buildReleaseDate({ precision: 'month', year: 2027, month: 1.5 })).toBeNull()
  })

  it('round-trips through parseReleaseDate', () => {
    for (const value of ['', '1999', '2027-Q1', '2027-11', '2028-02-29', '2100-12-31']) {
      expect(buildReleaseDate(parseReleaseDate(value)!)).toBe(value)
    }
  })
})

describe('formatReleaseDate', () => {
  it('formats every precision', () => {
    expect(formatReleaseDate('')).toBe('TBA')
    expect(formatReleaseDate('2027')).toBe('2027')
    expect(formatReleaseDate('2027-Q3')).toBe('Q3 2027')
    expect(formatReleaseDate('2027-03')).toBe('Mar 2027')
    expect(formatReleaseDate('2027-03-27')).toBe('Mar 27, 2027')
    expect(formatReleaseDate('2027-01-01')).toBe('Jan 1, 2027')
    expect(formatReleaseDate('2027-12')).toBe('Dec 2027')
  })

  it('trims input', () => {
    expect(formatReleaseDate('  2027-09-09  ')).toBe('Sep 9, 2027')
    expect(formatReleaseDate('   ')).toBe('TBA')
  })

  it('shows invalid input as typed instead of throwing', () => {
    expect(formatReleaseDate('2027-02-30')).toBe('2027-02-30')
    expect(formatReleaseDate(' soon ')).toBe('soon')
  })
})

describe('releaseDateRange', () => {
  it('returns null for TBA and invalid dates', () => {
    expect(releaseDateRange('')).toBeNull()
    expect(releaseDateRange('2027-13')).toBeNull()
  })

  it('covers the whole year', () => {
    expect(releaseDateRange('2027')).toEqual({ start: '2027-01-01', end: '2027-12-31' })
  })

  it('ends each quarter on its last day', () => {
    expect(releaseDateRange('2027-Q1')).toEqual({ start: '2027-01-01', end: '2027-03-31' })
    expect(releaseDateRange('2027-Q2')).toEqual({ start: '2027-04-01', end: '2027-06-30' })
    expect(releaseDateRange('2027-Q3')).toEqual({ start: '2027-07-01', end: '2027-09-30' })
    expect(releaseDateRange('2027-Q4')).toEqual({ start: '2027-10-01', end: '2027-12-31' })
  })

  it('ends each month on its last day, including February in leap years', () => {
    expect(releaseDateRange('2027-02')).toEqual({ start: '2027-02-01', end: '2027-02-28' })
    expect(releaseDateRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(releaseDateRange('2100-02')).toEqual({ start: '2100-02-01', end: '2100-02-28' })
    expect(releaseDateRange('2000-02')).toEqual({ start: '2000-02-01', end: '2000-02-29' })
    expect(releaseDateRange('2027-04')).toEqual({ start: '2027-04-01', end: '2027-04-30' })
    expect(releaseDateRange('2027-12')).toEqual({ start: '2027-12-01', end: '2027-12-31' })
  })

  it('is a single day for exact dates', () => {
    expect(releaseDateRange(' 2027-07-04 ')).toEqual({ start: '2027-07-04', end: '2027-07-04' })
  })
})

describe('releaseSortKey', () => {
  it('returns null for TBA and invalid dates', () => {
    expect(releaseSortKey('')).toBeNull()
    expect(releaseSortKey('   ')).toBeNull()
    expect(releaseSortKey('2027-02-30')).toBeNull()
  })

  it('orders exact dates before same-month month precision, then quarter, then year', () => {
    const ordered = ['2027-12-31', '2027-12', '2027-Q4', '2027']
    const keys = ordered.map((v) => releaseSortKey(v)!)
    expect([...keys].sort()).toEqual(keys)
    // Every key is distinct, so the order is total.
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('places vague dates after every specific date they could cover', () => {
    const values = [
      '2028-01-01',
      '2027',
      '2027-Q1',
      '2027-03',
      '2027-03-15',
      '2027-03-31',
      '2027-02',
      '2027-Q2',
      '2026-12-31',
      '2027-12-30',
    ]
    const sorted = [...values].sort((a, b) => releaseSortKey(a)!.localeCompare(releaseSortKey(b)!))
    expect(sorted).toEqual([
      '2026-12-31',
      '2027-02',
      '2027-03-15',
      '2027-03-31',
      '2027-03',
      '2027-Q1',
      '2027-Q2',
      '2027-12-30',
      '2027',
      '2028-01-01',
    ])
  })

  it('ignores surrounding whitespace', () => {
    expect(releaseSortKey(' 2027-Q2 ')).toBe(releaseSortKey('2027-Q2'))
  })
})

describe('todayISO', () => {
  it('formats the local date with zero padding', () => {
    expect(todayISO(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06')
    expect(todayISO(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01')
  })
})

describe('addDays', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2027-03-05', 0)).toBe('2027-03-05')
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-10-06', 30)).toBe('2026-11-05')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDays('2027-01-01', 365)).toBe('2028-01-01')
    expect(addDays('2028-01-01', 366)).toBe('2029-01-01')
  })

  it('is not affected by daylight-saving changes', () => {
    // Late March / late October are DST switches in many time zones.
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28')
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29')
    expect(addDays('2027-10-30', 1)).toBe('2027-10-31')
    expect(addDays('2027-10-31', 1)).toBe('2027-11-01')
  })
})

describe('daysUntil', () => {
  const today = '2026-10-06'

  it('counts whole days to exact dates', () => {
    expect(daysUntil('2026-10-06', today)).toBe(0)
    expect(daysUntil('2026-10-07', today)).toBe(1)
    expect(daysUntil('2026-11-05', today)).toBe(30)
    expect(daysUntil('2027-01-01', today)).toBe(87)
    expect(daysUntil('2026-10-05', today)).toBe(-1)
  })

  it('counts across DST changes and leap days', () => {
    expect(daysUntil('2027-04-01', '2027-03-01')).toBe(31)
    expect(daysUntil('2027-11-01', '2027-10-01')).toBe(31)
    expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2)
  })

  it('is null for anything but an exact valid date', () => {
    expect(daysUntil('', today)).toBeNull()
    expect(daysUntil('2026', today)).toBeNull()
    expect(daysUntil('2026-Q4', today)).toBeNull()
    expect(daysUntil('2026-10', today)).toBeNull()
    expect(daysUntil('2026-02-30', today)).toBeNull()
  })
})

describe('countdownLabel', () => {
  const today = '2026-10-06'

  it('labels today, tomorrow and later days', () => {
    expect(countdownLabel('2026-10-06', today)).toBe('Today')
    expect(countdownLabel('2026-10-07', today)).toBe('Tomorrow')
    expect(countdownLabel('2026-10-08', today)).toBe('in 2 days')
    expect(countdownLabel('2027-01-01', today)).toBe('in 87 days')
  })

  it('is null for past dates', () => {
    expect(countdownLabel('2026-10-05', today)).toBeNull()
    expect(countdownLabel('2020-01-01', today)).toBeNull()
  })

  it('is null for vague, TBA and invalid dates', () => {
    expect(countdownLabel('', today)).toBeNull()
    expect(countdownLabel('2026-10', today)).toBeNull()
    expect(countdownLabel('2026-Q4', today)).toBeNull()
    expect(countdownLabel('2026', today)).toBeNull()
    expect(countdownLabel('2026-10-32', today)).toBeNull()
  })
})
