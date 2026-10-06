import { describe, expect, it } from 'vitest'
import { createEmptyGame } from '../../domain/game'
import { dateDraftFrom, resolveDateDraft, switchPrecision, type DateDraft } from './dateDraft'
import { buildGame, formSnapshot, hasFormErrors, initialForm, validateForm } from './formState'

const blank: DateDraft = { precision: 'tba', year: '', quarter: '', month: '', date: '' }

describe('dateDraftFrom / resolveDateDraft round trip', () => {
  it.each(['', '2027', '2027-Q3', '2027-03', '2027-03-27'])('keeps %j unchanged', (value) => {
    expect(resolveDateDraft(dateDraftFrom(value))).toEqual({ value, error: null, part: null })
  })

  it('derives the quarter of a known month', () => {
    expect(dateDraftFrom('2027-08').quarter).toBe('3')
    expect(dateDraftFrom('2027-11-02')).toMatchObject({ year: '2027', month: '11', quarter: '4' })
  })
})

describe('resolveDateDraft errors', () => {
  it('points at the missing part', () => {
    expect(resolveDateDraft({ ...blank, precision: 'month', year: '2027' })).toMatchObject({ value: null, part: 'month' })
    expect(resolveDateDraft({ ...blank, precision: 'quarter', year: '2027' })).toMatchObject({ value: null, part: 'quarter' })
    expect(resolveDateDraft({ ...blank, precision: 'year' })).toMatchObject({ error: 'Enter a year.', part: 'year' })
    expect(resolveDateDraft({ ...blank, precision: 'year', year: '19' })).toMatchObject({ value: null, part: 'year' })
    expect(resolveDateDraft({ ...blank, precision: 'year', year: '2200' })).toMatchObject({ value: null, part: 'year' })
    expect(resolveDateDraft({ ...blank, precision: 'day' })).toMatchObject({ error: 'Pick a date.', part: 'day' })
    expect(resolveDateDraft({ ...blank, precision: 'day', date: '1900-01-01' })).toMatchObject({ value: null, part: 'day' })
  })
})

describe('switchPrecision', () => {
  const resolve = (d: DateDraft) => resolveDateDraft(d).value

  it('keeps the year and derives month/quarter', () => {
    const day = dateDraftFrom('2027-09-14')
    expect(resolve(switchPrecision(day, 'month'))).toBe('2027-09')
    expect(resolve(switchPrecision(day, 'quarter'))).toBe('2027-Q3')
    expect(resolve(switchPrecision(day, 'year'))).toBe('2027')
    expect(resolve(switchPrecision(day, 'tba'))).toBe('')
  })

  it('starts a quarter at its first month, and a month at its first day', () => {
    const q = dateDraftFrom('2027-Q3')
    expect(resolve(switchPrecision(q, 'month'))).toBe('2027-07')
    expect(resolve(switchPrecision(q, 'day'))).toBe('2027-07-01')
    expect(resolve(switchPrecision(dateDraftFrom('2027'), 'day'))).toBe('2027-01-01')
  })

  it('restores an earlier exact date that still fits', () => {
    const asQuarter = switchPrecision(dateDraftFrom('2027-09-14'), 'quarter')
    expect(resolve(switchPrecision(asQuarter, 'day'))).toBe('2027-09-14')
    // A different quarter no longer fits.
    expect(resolve(switchPrecision({ ...asQuarter, quarter: '1' }, 'day'))).toBe('2027-01-01')
  })

  it('remembers parts across TBA', () => {
    const tba = switchPrecision(dateDraftFrom('2027-05'), 'tba')
    expect(resolve(switchPrecision(tba, 'month'))).toBe('2027-05')
  })

  it('leaves parts empty when nothing is known', () => {
    expect(switchPrecision(blank, 'month')).toMatchObject({ precision: 'month', year: '', month: '' })
    expect(switchPrecision(blank, 'day')).toMatchObject({ precision: 'day', date: '' })
  })
})

describe('form state', () => {
  const game = { ...createEmptyGame('2026-01-01T00:00:00.000Z', 'g1'), title: 'Test' }

  it('is clean until something changes', () => {
    const form = initialForm(game)
    const base = formSnapshot(form)
    expect(formSnapshot(initialForm(structuredClone(game)))).toBe(base)
    expect(formSnapshot({ ...form, game: { ...game, title: 'Other' } })).not.toBe(base)
    expect(formSnapshot({ ...form, screenshotText: 'https://a.b/c.png' })).not.toBe(base)
    // Switching precision and back to the same value is not a change.
    expect(formSnapshot({ ...form, date: switchPrecision(switchPrecision(form.date, 'year'), 'tba') })).toBe(base)
    expect(formSnapshot({ ...form, date: switchPrecision(form.date, 'year') })).not.toBe(base)
  })

  it('validates title, dates and URLs', () => {
    const form = initialForm({ ...game, title: '  ' })
    expect(validateForm(form).title).toBe('Title is required.')
    expect(hasFormErrors(validateForm(initialForm(game)))).toBe(false)

    const bad = initialForm({
      ...game,
      coverUrl: 'cover.jpg',
      trailers: [
        { title: 'Reveal', url: '' },
        { title: '', url: '' },
        { title: '', url: 'javascript:alert(1)' },
      ],
      links: [{ label: 'Site', url: 'https://example.com' }],
    })
    const errors = validateForm({ ...bad, screenshotText: 'nope' })
    expect(errors.coverUrl).toBeDefined()
    expect(errors.screenshots).toBeDefined()
    expect(errors.trailers.map(Boolean)).toEqual([true, false, true])
    expect(errors.links).toEqual([undefined])
    expect(hasFormErrors(errors)).toBe(true)
  })

  it('builds the game with the resolved date and pending screenshots', () => {
    const form = initialForm(game)
    const built = buildGame({
      ...form,
      date: { ...blank, precision: 'quarter', year: '2028', quarter: '2' },
      screenshotText: ' https://example.com/a.png  https://example.com/b.png ',
    })
    expect(built.releaseDate).toBe('2028-Q2')
    expect(built.screenshots).toEqual(['https://example.com/a.png', 'https://example.com/b.png'])
  })
})
