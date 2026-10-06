import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, RELEASE_WINDOWS } from './constants'
import {
  activeFilterCount,
  collectFacet,
  filterGames,
  isDefaultFilters,
  matchesFilters,
  matchesReleaseWindow,
  sanitizeFilters,
  type FilterContext,
} from './filtering'
import { createEmptyGame } from './game'
import type { Filters, Game, ReleaseWindow, Tag } from './types'

const TODAY = '2026-10-06'

const tags: Tag[] = [
  { id: 'coop', name: 'Co-op', color: '#000', createdAt: '' },
  { id: 'story', name: 'Story-rich', color: '#000', createdAt: '' },
  { id: 'cafe', name: 'Café vibes', color: '#000', createdAt: '' },
]
const ctx: FilterContext = { tagsById: new Map(tags.map((t) => [t.id, t])), today: TODAY }

function game(id: string, patch: Partial<Game> = {}): Game {
  return { ...createEmptyGame('2026-01-01T00:00:00.000Z', id), title: id, ...patch }
}

function filters(patch: Partial<Filters> = {}): Filters {
  return { ...DEFAULT_FILTERS, ...patch }
}

const ids = (games: readonly Game[]) => games.map((g) => g.id)

// ── Library used by most tests ───────────────────────────────────────────────
const starfall = game('starfall', {
  title: 'Starfall Odyssey',
  priority: 'must',
  releaseStatus: 'announced',
  personalStatus: 'preordered',
  releaseDate: '2026-10-18',
  platforms: ['PC', 'PlayStation 5'],
  genres: ['RPG', 'Open World'],
  developers: ['Nebula Forge'],
  publishers: ['Orbit Interactive'],
  tagIds: ['story', 'coop'],
})
const otzi = game('otzi', {
  title: 'Ötzi: The Iceman',
  priority: 'high',
  releaseStatus: 'released',
  personalStatus: 'playing',
  releaseDate: '2026-03-01',
  platforms: ['pc', 'Nintendo Switch'],
  genres: ['Acción', 'Adventure'],
  developers: ['Glacier Games'],
  publishers: ['Alpine Publishing'],
  tagIds: ['cafe'],
})
const lantern = game('lantern', {
  title: 'Hollow Lantern',
  priority: 'maybe',
  releaseStatus: 'rumored',
  releaseDate: '',
  platforms: ['Nintendo Switch 2'],
  genres: ['Metroidvania'],
  developers: ['Moth & Candle'],
  publishers: ['Moth & Candle'],
  tagIds: ['coop'],
})
const tactics = game('tactics', {
  title: 'Iron Tide Tactics',
  priority: 'watching',
  releaseStatus: 'cancelled',
  personalStatus: 'skipped',
  releaseDate: '2027-Q2',
  platforms: ['Xbox Series X|S'],
  genres: ['Strategy'],
  developers: ['Anchor Bay'],
  publishers: ['Starboard Media'],
})
const library = [starfall, otzi, lantern, tactics]
const run = (f: Partial<Filters>, games: readonly Game[] = library) => ids(filterGames(games, filters(f), ctx))

describe('filterGames', () => {
  it('returns everything with default filters', () => {
    expect(run({})).toEqual(['starfall', 'otzi', 'lantern', 'tactics'])
  })

  it('keeps the input order', () => {
    expect(run({}, [...library].reverse())).toEqual(['tactics', 'lantern', 'otzi', 'starfall'])
  })

  it('filters by priority (any of)', () => {
    expect(run({ priorities: ['must'] })).toEqual(['starfall'])
    expect(run({ priorities: ['must', 'watching'] })).toEqual(['starfall', 'tactics'])
    expect(run({ priorities: ['interested'] })).toEqual([])
  })

  it('filters by release status (any of)', () => {
    expect(run({ releaseStatuses: ['released'] })).toEqual(['otzi'])
    expect(run({ releaseStatuses: ['rumored', 'cancelled'] })).toEqual(['lantern', 'tactics'])
  })

  it('filters by personal status, including "not set"', () => {
    expect(run({ personalStatuses: ['none'] })).toEqual(['lantern'])
    expect(run({ personalStatuses: ['playing', 'preordered'] })).toEqual(['starfall', 'otzi'])
  })

  describe('tags', () => {
    it('any: games with at least one of the tags', () => {
      expect(run({ tagIds: ['coop'] })).toEqual(['starfall', 'lantern'])
      expect(run({ tagIds: ['story', 'cafe'], tagMatch: 'any' })).toEqual(['starfall', 'otzi'])
    })

    it('all: games with every one of the tags', () => {
      expect(run({ tagIds: ['story', 'coop'], tagMatch: 'all' })).toEqual(['starfall'])
      expect(run({ tagIds: ['coop'], tagMatch: 'all' })).toEqual(['starfall', 'lantern'])
      expect(run({ tagIds: ['cafe', 'coop'], tagMatch: 'all' })).toEqual([])
    })

    it('tag match mode has no effect without selected tags', () => {
      expect(run({ tagMatch: 'all' })).toHaveLength(4)
    })
  })

  describe('platforms and genres', () => {
    it('match any of the selected values, ignoring case', () => {
      expect(run({ platforms: ['pc'] })).toEqual(['starfall', 'otzi'])
      expect(run({ platforms: ['PC'] })).toEqual(['starfall', 'otzi'])
      expect(run({ platforms: ['nintendo switch', 'xbox series x|s'] })).toEqual(['otzi', 'tactics'])
      expect(run({ genres: ['rpg'] })).toEqual(['starfall'])
    })

    it('ignore accents', () => {
      expect(run({ genres: ['Accion'] })).toEqual(['otzi'])
      expect(run({ genres: ['ACCIÓN'] })).toEqual(['otzi'])
    })

    it('match whole values, not substrings', () => {
      // "Nintendo Switch" must not match "Nintendo Switch 2".
      expect(run({ platforms: ['Nintendo Switch'] })).toEqual(['otzi'])
      expect(run({ genres: ['World'] })).toEqual([])
    })
  })

  describe('search', () => {
    it('matches the title, case- and accent-insensitively', () => {
      expect(run({ search: 'starfall' })).toEqual(['starfall'])
      expect(run({ search: 'STARFALL' })).toEqual(['starfall'])
      expect(run({ search: 'odys' })).toEqual(['starfall'])
      expect(run({ search: 'otzi' })).toEqual(['otzi'])
      expect(run({ search: 'ÖTZI' })).toEqual(['otzi'])
      expect(run({ search: 'iceman' })).toEqual(['otzi'])
    })

    it('matches developers, publishers, genres, platforms and tag names', () => {
      expect(run({ search: 'nebula' })).toEqual(['starfall'])
      expect(run({ search: 'alpine' })).toEqual(['otzi'])
      expect(run({ search: 'metroidvania' })).toEqual(['lantern'])
      expect(run({ search: 'xbox' })).toEqual(['tactics'])
      expect(run({ search: 'story-rich' })).toEqual(['starfall'])
      expect(run({ search: 'co-op' })).toEqual(['starfall', 'lantern'])
      expect(run({ search: 'cafe' })).toEqual(['otzi'])
      expect(run({ search: 'accion' })).toEqual(['otzi'])
    })

    it('matches publishers that share words with titles', () => {
      // "Starboard Media" publishes Iron Tide Tactics; "Starfall" is a title.
      expect(run({ search: 'star' })).toEqual(['starfall', 'tactics'])
    })

    it('requires every word to match somewhere (AND)', () => {
      expect(run({ search: 'starfall nebula' })).toEqual(['starfall'])
      expect(run({ search: '  nebula   ORBIT ' })).toEqual(['starfall'])
      expect(run({ search: 'starfall glacier' })).toEqual([])
      expect(run({ search: 'moth candle' })).toEqual(['lantern'])
    })

    it('ignores whitespace-only searches', () => {
      expect(run({ search: '   ' })).toHaveLength(4)
    })

    it('does not match tag ids or names of tags the game does not have', () => {
      expect(run({ search: 'story' }, [lantern])).toEqual([])
    })

    it('ignores deleted tags', () => {
      const orphan = game('orphan', { title: 'Orphan', tagIds: ['gone'] })
      expect(run({ search: 'gone' }, [orphan])).toEqual([])
      expect(run({ search: 'orphan' }, [orphan])).toEqual(['orphan'])
    })
  })

  it('combines every filter with AND', () => {
    expect(
      run({
        priorities: ['must', 'high'],
        platforms: ['pc'],
        releaseWindow: 'upcoming',
        tagIds: ['story'],
        search: 'odyssey',
      }),
    ).toEqual(['starfall'])
    expect(run({ priorities: ['must', 'high'], platforms: ['pc'] })).toEqual(['starfall', 'otzi'])
    expect(run({ priorities: ['must', 'high'], platforms: ['pc'], releaseStatuses: ['released'] })).toEqual(['otzi'])
    expect(run({ priorities: ['must'], releaseWindow: 'released' })).toEqual([])
  })

  it('matchesFilters agrees with filterGames', () => {
    const f = filters({ platforms: ['PC'] })
    expect(matchesFilters(starfall, f, ctx)).toBe(true)
    expect(matchesFilters(lantern, f, ctx)).toBe(false)
  })
})

describe('matchesReleaseWindow', () => {
  type Case = [string, Partial<Game>]
  const cases: Record<string, Case> = {
    today: ['today', { releaseDate: '2026-10-06' }],
    yesterday: ['yesterday', { releaseDate: '2026-10-05' }],
    in12: ['in 12 days', { releaseDate: '2026-10-18' }],
    in30: ['in 30 days', { releaseDate: '2026-11-05' }],
    in31: ['in 31 days', { releaseDate: '2026-11-06' }],
    thisMonth: ['this month', { releaseDate: '2026-10' }],
    lastMonth: ['last month', { releaseDate: '2026-09' }],
    nextMonth: ['next month', { releaseDate: '2026-11' }],
    inTwoMonths: ['in two months', { releaseDate: '2026-12' }],
    thisQuarter: ['this quarter', { releaseDate: '2026-Q4' }],
    lastQuarter: ['last quarter', { releaseDate: '2026-Q3' }],
    thisYear: ['this year', { releaseDate: '2026' }],
    lastYear: ['last year', { releaseDate: '2025' }],
    nextYear: ['next year', { releaseDate: '2027' }],
    nextYearQ1: ['next year Q1', { releaseDate: '2027-Q1' }],
    nextYearDay: ['next year day', { releaseDate: '2027-06-01' }],
    farFuture: ['2028', { releaseDate: '2028-01' }],
    tba: ['TBA', { releaseDate: '' }],
    releasedPast: ['released (past)', { releaseStatus: 'released', releaseDate: '2026-03-01' }],
    releasedFuture: ['released (future date)', { releaseStatus: 'released', releaseDate: '2026-10-20' }],
    releasedTba: ['released (TBA)', { releaseStatus: 'released', releaseDate: '' }],
    cancelledFuture: ['cancelled (future)', { releaseStatus: 'cancelled', releaseDate: '2026-10-20' }],
    cancelledTba: ['cancelled (TBA)', { releaseStatus: 'cancelled', releaseDate: '' }],
    earlyAccessSoon: ['early access (soon)', { releaseStatus: 'early_access', releaseDate: '2026-10-10' }],
    rumoredThisYear: ['rumored (this year)', { releaseStatus: 'rumored', releaseDate: '2026-Q4' }],
  }
  const games = Object.entries(cases).map(([id, [, patch]]) => game(id, patch))
  const inWindow = (w: ReleaseWindow, today = TODAY) =>
    games.filter((g) => matchesReleaseWindow(g, w, today)).map((g) => g.id)

  it('any: everything', () => {
    expect(inWindow('any')).toHaveLength(games.length)
  })

  it('upcoming: not released/cancelled, dated today or later, TBA included', () => {
    expect(inWindow('upcoming')).toEqual([
      'today',
      'in12',
      'in30',
      'in31',
      'thisMonth',
      'nextMonth',
      'inTwoMonths',
      'thisQuarter',
      'thisYear',
      'nextYear',
      'nextYearQ1',
      'nextYearDay',
      'farFuture',
      'tba',
      'earlyAccessSoon',
      'rumoredThisYear',
    ])
  })

  it('next30: only day/month precision overlapping [today, today+30], not released/cancelled', () => {
    expect(inWindow('next30')).toEqual(['today', 'in12', 'in30', 'thisMonth', 'nextMonth', 'earlyAccessSoon'])
  })

  it('next30 crosses the year boundary', () => {
    const g = [
      game('jan14', { releaseDate: '2027-01-14' }),
      game('jan19', { releaseDate: '2027-01-19' }),
      game('jan20', { releaseDate: '2027-01-20' }),
      game('jan', { releaseDate: '2027-01' }),
      game('q1', { releaseDate: '2027-Q1' }),
    ]
    expect(ids(g.filter((x) => matchesReleaseWindow(x, 'next30', '2026-12-20')))).toEqual(['jan14', 'jan19', 'jan'])
  })

  it('thisYear: dates that start this year, any status', () => {
    expect(inWindow('thisYear')).toEqual([
      'today',
      'yesterday',
      'in12',
      'in30',
      'in31',
      'thisMonth',
      'lastMonth',
      'nextMonth',
      'inTwoMonths',
      'thisQuarter',
      'lastQuarter',
      'thisYear',
      'releasedPast',
      'releasedFuture',
      'cancelledFuture',
      'earlyAccessSoon',
      'rumoredThisYear',
    ])
  })

  it('nextYear: dates that start next year', () => {
    expect(inWindow('nextYear')).toEqual(['nextYear', 'nextYearQ1', 'nextYearDay'])
  })

  it('tba: no release date, any status', () => {
    expect(inWindow('tba')).toEqual(['tba', 'releasedTba', 'cancelledTba'])
  })

  it('released: release status is released', () => {
    expect(inWindow('released')).toEqual(['releasedPast', 'releasedFuture', 'releasedTba'])
  })

  it('every window in RELEASE_WINDOWS is handled', () => {
    for (const { value } of RELEASE_WINDOWS) {
      expect(() => inWindow(value)).not.toThrow()
      for (const g of games) expect(typeof matchesReleaseWindow(g, value, TODAY)).toBe('boolean')
    }
  })

  it('upcoming follows "today"', () => {
    const g = game('g', { releaseDate: '2026-10-06' })
    expect(matchesReleaseWindow(g, 'upcoming', '2026-10-06')).toBe(true)
    expect(matchesReleaseWindow(g, 'upcoming', '2026-10-07')).toBe(false)
    const m = game('m', { releaseDate: '2026-10' })
    expect(matchesReleaseWindow(m, 'upcoming', '2026-10-31')).toBe(true)
    expect(matchesReleaseWindow(m, 'upcoming', '2026-11-01')).toBe(false)
  })
})

describe('activeFilterCount / isDefaultFilters', () => {
  it('is zero for the defaults', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true)
  })

  it('counts each active group once and ignores the search box', () => {
    expect(activeFilterCount(filters({ search: 'abc' }))).toBe(0)
    expect(activeFilterCount(filters({ priorities: ['must', 'high'] }))).toBe(1)
    expect(activeFilterCount(filters({ releaseStatuses: ['released'] }))).toBe(1)
    expect(activeFilterCount(filters({ personalStatuses: ['none'] }))).toBe(1)
    expect(activeFilterCount(filters({ tagIds: ['a', 'b'], tagMatch: 'all' }))).toBe(1)
    expect(activeFilterCount(filters({ platforms: ['PC'] }))).toBe(1)
    expect(activeFilterCount(filters({ genres: ['RPG'] }))).toBe(1)
    expect(activeFilterCount(filters({ releaseWindow: 'tba' }))).toBe(1)
    expect(activeFilterCount(filters({ tagMatch: 'all' }))).toBe(0)
    expect(
      activeFilterCount(
        filters({
          search: 'x',
          priorities: ['must'],
          releaseStatuses: ['announced'],
          personalStatuses: ['wishlist'],
          tagIds: ['a'],
          platforms: ['PC'],
          genres: ['RPG'],
          releaseWindow: 'upcoming',
        }),
      ),
    ).toBe(7)
  })

  it('isDefaultFilters considers the search box but not whitespace', () => {
    expect(isDefaultFilters(filters({ search: '  ' }))).toBe(true)
    expect(isDefaultFilters(filters({ search: 'x' }))).toBe(false)
    expect(isDefaultFilters(filters({ genres: ['RPG'] }))).toBe(false)
    expect(isDefaultFilters(filters({ tagMatch: 'all' }))).toBe(true)
  })
})

describe('sanitizeFilters', () => {
  const existing = new Set(['coop', 'story'])

  it.each([null, undefined, 42, 'filters', true, [], [1, 2]])('turns %j into the defaults', (raw) => {
    expect(sanitizeFilters(raw, existing)).toEqual(DEFAULT_FILTERS)
  })

  it('keeps valid filters unchanged', () => {
    const valid: Filters = {
      search: 'odyssey',
      priorities: ['must', 'high'],
      releaseStatuses: ['announced'],
      personalStatuses: ['none', 'wishlist'],
      tagIds: ['coop', 'story'],
      tagMatch: 'all',
      platforms: ['PC'],
      genres: ['RPG'],
      releaseWindow: 'next30',
    }
    expect(sanitizeFilters(structuredClone(valid), existing)).toEqual(valid)
  })

  it('fills missing keys from the defaults', () => {
    expect(sanitizeFilters({ search: 'x' }, existing)).toEqual({ ...DEFAULT_FILTERS, search: 'x' })
  })

  it('drops unknown enum values and wrong types', () => {
    const out = sanitizeFilters(
      {
        search: 42,
        priorities: ['must', 'urgent', 5, null],
        releaseStatuses: 'released',
        personalStatuses: ['owned', 'playing'],
        tagMatch: 'ALL',
        platforms: ['PC', 3, null, { a: 1 }],
        genres: { 0: 'RPG' },
        releaseWindow: 'soon',
      },
      existing,
    )
    expect(out).toEqual({
      ...DEFAULT_FILTERS,
      priorities: ['must'],
      personalStatuses: ['playing'],
      platforms: ['PC'],
    })
  })

  it('drops tags that no longer exist', () => {
    expect(sanitizeFilters({ tagIds: ['coop', 'deleted', 7, 'story'] }, existing).tagIds).toEqual(['coop', 'story'])
    expect(sanitizeFilters({ tagIds: ['coop'] }, new Set()).tagIds).toEqual([])
  })

  it('accepts every known release window', () => {
    for (const { value } of RELEASE_WINDOWS) {
      expect(sanitizeFilters({ releaseWindow: value }, existing).releaseWindow).toBe(value)
    }
  })

  it('returns a fresh object, never the shared defaults', () => {
    const out = sanitizeFilters(null, existing)
    expect(out).not.toBe(DEFAULT_FILTERS)
    expect(out.priorities).not.toBe(DEFAULT_FILTERS.priorities)
  })
})

describe('collectFacet', () => {
  const games = [
    game('a', { platforms: ['PC', 'PlayStation 5'], developers: ['Studio Ü'] }),
    game('b', { platforms: ['pc', 'Xbox'], developers: ['studio u'] }),
    game('c', { platforms: ['PlayStation 5', 'PC'] }),
    game('d', { platforms: ['Amiga'] }),
  ]

  it('counts values case-insensitively, keeping the first spelling', () => {
    expect(collectFacet(games, 'platforms')).toEqual([
      { value: 'PC', count: 3 },
      { value: 'PlayStation 5', count: 2 },
      { value: 'Amiga', count: 1 },
      { value: 'Xbox', count: 1 },
    ])
  })

  it('folds accents too', () => {
    expect(collectFacet(games, 'developers')).toEqual([{ value: 'Studio Ü', count: 2 }])
  })

  it('is empty for no values', () => {
    expect(collectFacet(games, 'publishers')).toEqual([])
    expect(collectFacet([], 'genres')).toEqual([])
  })
})
