import { describe, expect, it } from 'vitest'
import { SORT_FIELDS } from './constants'
import { createEmptyGame } from './game'
import { sortGames, sortValue } from './sorting'
import type { Game, SortDirection, SortField, Tag } from './types'

let seq = 0
function game(title: string, patch: Partial<Game> = {}): Game {
  seq++
  const created = `2026-01-${String(seq).padStart(2, '0')}T00:00:00.000Z`
  return { ...createEmptyGame(created, `id-${title || 'untitled'}-${seq}`), title, ...patch }
}

const tags: Tag[] = [
  { id: 't-zeta', name: 'zeta', color: '#000', createdAt: '' },
  { id: 't-alpha', name: 'Alpha', color: '#000', createdAt: '' },
  { id: 't-mid', name: 'Mid', color: '#000', createdAt: '' },
]
const tagsById = new Map(tags.map((t) => [t.id, t]))

const titles = (games: readonly Game[]) => games.map((g) => g.title)
const sortBy = (games: readonly Game[], field: SortField, direction: SortDirection = 'asc') =>
  titles(sortGames(games, { field, direction }, tagsById))

describe('sortGames', () => {
  it('returns a new array and leaves the input untouched', () => {
    const input = [game('B'), game('A')]
    const copy = [...input]
    const out = sortGames(input, { field: 'title', direction: 'asc' }, tagsById)
    expect(out).not.toBe(input)
    expect(input).toEqual(copy)
    expect(titles(out)).toEqual(['A', 'B'])
  })

  it('handles empty and single-item lists', () => {
    expect(sortGames([], { field: 'title', direction: 'asc' }, tagsById)).toEqual([])
    const one = [game('Solo')]
    expect(sortGames(one, { field: 'tags', direction: 'desc' }, tagsById)).toEqual(one)
  })

  describe('title', () => {
    const games = [game('beta'), game('Alpha'), game('Ötzi'), game('gamma 10'), game('gamma 9'), game('Zed'), game('')]

    it('sorts A→Z case/accent-insensitively with natural numbers', () => {
      expect(sortBy(games, 'title')).toEqual(['Alpha', 'beta', 'gamma 9', 'gamma 10', 'Ötzi', 'Zed', ''])
    })

    it('reverses for desc, keeping untitled games last', () => {
      expect(sortBy(games, 'title', 'desc')).toEqual(['Zed', 'Ötzi', 'gamma 10', 'gamma 9', 'beta', 'Alpha', ''])
    })
  })

  describe('priority', () => {
    const games = [
      game('W', { priority: 'watching' }),
      game('M', { priority: 'must' }),
      game('I', { priority: 'interested' }),
      game('H', { priority: 'high' }),
      game('May', { priority: 'maybe' }),
    ]

    it('asc puts Must Play first', () => {
      expect(sortBy(games, 'priority')).toEqual(['M', 'H', 'I', 'May', 'W'])
    })

    it('desc puts Watching first', () => {
      expect(sortBy(games, 'priority', 'desc')).toEqual(['W', 'May', 'I', 'H', 'M'])
    })
  })

  describe('releaseDate', () => {
    const games = [
      game('Year', { releaseDate: '2027' }),
      game('TBA', { releaseDate: '' }),
      game('Quarter', { releaseDate: '2027-Q4' }),
      game('Day', { releaseDate: '2027-12-31' }),
      game('Month', { releaseDate: '2027-12' }),
      game('Early', { releaseDate: '2026-11-02' }),
      game('Next year', { releaseDate: '2028-01-01' }),
      game('Also TBA', { releaseDate: '' }),
    ]

    it('asc: earliest first, exact before month before quarter before year, TBA last', () => {
      expect(sortBy(games, 'releaseDate')).toEqual([
        'Early',
        'Day',
        'Month',
        'Quarter',
        'Year',
        'Next year',
        'Also TBA',
        'TBA',
      ])
    })

    it('desc: latest first, TBA still last (by title)', () => {
      expect(sortBy(games, 'releaseDate', 'desc')).toEqual([
        'Next year',
        'Year',
        'Quarter',
        'Month',
        'Day',
        'Early',
        'Also TBA',
        'TBA',
      ])
    })
  })

  describe('releaseStatus', () => {
    const games = [
      game('Cancelled', { releaseStatus: 'cancelled' }),
      game('Rumored', { releaseStatus: 'rumored' }),
      game('Released', { releaseStatus: 'released' }),
      game('Announced', { releaseStatus: 'announced' }),
      game('EA', { releaseStatus: 'early_access' }),
    ]

    it('follows the lifecycle order', () => {
      expect(sortBy(games, 'releaseStatus')).toEqual(['Rumored', 'Announced', 'EA', 'Released', 'Cancelled'])
      expect(sortBy(games, 'releaseStatus', 'desc')).toEqual(['Cancelled', 'Released', 'EA', 'Announced', 'Rumored'])
    })
  })

  describe('personalStatus', () => {
    const games = [
      game('None B', { personalStatus: 'none' }),
      game('Finished', { personalStatus: 'finished' }),
      game('Wishlist', { personalStatus: 'wishlist' }),
      game('None A', { personalStatus: 'none' }),
      game('Playing', { personalStatus: 'playing' }),
    ]

    it('puts "not set" last in both directions', () => {
      expect(sortBy(games, 'personalStatus')).toEqual(['Wishlist', 'Playing', 'Finished', 'None A', 'None B'])
      expect(sortBy(games, 'personalStatus', 'desc')).toEqual(['Finished', 'Playing', 'Wishlist', 'None A', 'None B'])
    })
  })

  describe.each(['platforms', 'genres', 'developers', 'publishers'] as const)('%s', (field) => {
    const games = [
      game('Empty B', { [field]: [] }),
      game('Zulu only', { [field]: ['zulu'] }),
      game('Alpha+Mike', { [field]: ['Mike', 'alpha'] }),
      game('Empty A', { [field]: [] }),
      game('Bravo', { [field]: ['Bravo'] }),
    ]

    it('sorts by the alphabetically first value, empty lists last', () => {
      expect(sortBy(games, field)).toEqual(['Alpha+Mike', 'Bravo', 'Zulu only', 'Empty A', 'Empty B'])
    })

    it('desc keeps empty lists last', () => {
      expect(sortBy(games, field, 'desc')).toEqual(['Zulu only', 'Bravo', 'Alpha+Mike', 'Empty A', 'Empty B'])
    })
  })

  describe('tags', () => {
    const games = [
      game('No tags', { tagIds: [] }),
      game('Zeta', { tagIds: ['t-zeta'] }),
      game('Mid+Alpha', { tagIds: ['t-mid', 't-alpha'] }),
      game('Unknown only', { tagIds: ['t-deleted'] }),
      game('Mid', { tagIds: ['t-mid', 't-deleted'] }),
    ]

    it('sorts by tag names, not ids; games without (known) tags last', () => {
      expect(sortBy(games, 'tags')).toEqual(['Mid+Alpha', 'Mid', 'Zeta', 'No tags', 'Unknown only'])
      expect(sortBy(games, 'tags', 'desc')).toEqual(['Zeta', 'Mid', 'Mid+Alpha', 'No tags', 'Unknown only'])
    })

    it('uses the tag name rather than the tag id', () => {
      // Ids sort "t-alpha" < "t-zeta"; names sort "Alpha" < "zeta" too, so pick ids that disagree.
      const byName = new Map<string, Tag>([
        ['a', { id: 'a', name: 'Zzz', color: '', createdAt: '' }],
        ['z', { id: 'z', name: 'Aaa', color: '', createdAt: '' }],
      ])
      const out = sortGames([game('A-id', { tagIds: ['a'] }), game('Z-id', { tagIds: ['z'] })], { field: 'tags', direction: 'asc' }, byName)
      expect(titles(out)).toEqual(['Z-id', 'A-id'])
    })
  })

  describe.each(['createdAt', 'updatedAt'] as const)('%s', (field) => {
    const games = [
      game('Mid', { [field]: '2026-05-01T12:00:00.000Z' }),
      game('Old', { [field]: '2025-12-31T23:59:59.999Z' }),
      game('Missing', { [field]: '' }),
      game('New', { [field]: '2026-10-06T08:00:00.000Z' }),
    ]

    it('asc is oldest first, missing timestamps last', () => {
      expect(sortBy(games, field)).toEqual(['Old', 'Mid', 'New', 'Missing'])
    })

    it('desc is newest first, missing timestamps last', () => {
      expect(sortBy(games, field, 'desc')).toEqual(['New', 'Mid', 'Old', 'Missing'])
    })
  })

  describe('ties', () => {
    it('break by title A→Z in both directions', () => {
      const games = [
        game('Charlie', { priority: 'must' }),
        game('alpha', { priority: 'must' }),
        game('Bravo', { priority: 'must' }),
        game('Delta', { priority: 'high' }),
      ]
      expect(sortBy(games, 'priority')).toEqual(['alpha', 'Bravo', 'Charlie', 'Delta'])
      expect(sortBy(games, 'priority', 'desc')).toEqual(['Delta', 'alpha', 'Bravo', 'Charlie'])
    })

    it('between empty values break by title A→Z in both directions', () => {
      const games = [game('Zed'), game('Abe'), game('Moe')]
      expect(sortBy(games, 'releaseDate')).toEqual(['Abe', 'Moe', 'Zed'])
      expect(sortBy(games, 'releaseDate', 'desc')).toEqual(['Abe', 'Moe', 'Zed'])
    })

    it('between identical titles break by creation time, then id', () => {
      const a = { ...game('Same'), id: 'b', createdAt: '2026-01-01' }
      const b = { ...game('Same'), id: 'a', createdAt: '2026-02-01' }
      const c = { ...game('Same'), id: 'c', createdAt: '2026-01-01' }
      const out = sortGames([b, c, a], { field: 'title', direction: 'asc' }, tagsById)
      expect(out.map((g) => g.id)).toEqual(['b', 'c', 'a'])
    })
  })

  it('is deterministic regardless of input order, for every field and direction', () => {
    const games = [
      game('Alpha', { priority: 'must', releaseDate: '2027-Q1', platforms: ['PC'], tagIds: ['t-mid'], personalStatus: 'wishlist' }),
      game('alpha', { priority: 'must', releaseDate: '2027-Q1', platforms: ['pc'], tagIds: ['t-mid'] }),
      game('Beta', { priority: 'maybe', releaseDate: '', genres: ['RPG'], personalStatus: 'bought' }),
      game('Gamma', { priority: 'must', releaseDate: '2027-03-31', developers: ['Studio'], tagIds: ['t-zeta'] }),
      game('', { priority: 'high', releaseDate: '2026', publishers: ['Pub'] }),
      game('Delta', { priority: 'high', releaseDate: '2027-03', platforms: ['PS5', 'PC'] }),
      game('Delta', { priority: 'high', releaseDate: '2027-03', platforms: ['PS5', 'PC'] }),
    ]
    const permutations = [games, [...games].reverse(), [3, 0, 6, 2, 5, 1, 4].map((i) => games[i])]
    for (const { value: field } of SORT_FIELDS) {
      for (const direction of ['asc', 'desc'] as const) {
        const results = permutations.map((p) => sortGames(p, { field, direction }, tagsById).map((g) => g.id))
        expect(results[1], `${field} ${direction}`).toEqual(results[0])
        expect(results[2], `${field} ${direction}`).toEqual(results[0])
      }
    }
  })

  it('puts empty values last for every field in both directions', () => {
    const full = game('Full', {
      releaseDate: '2027-01-01',
      personalStatus: 'playing',
      platforms: ['PC'],
      genres: ['RPG'],
      developers: ['Dev'],
      publishers: ['Pub'],
      tagIds: ['t-alpha'],
    })
    const empty = game('Empty', { createdAt: '', updatedAt: '' })
    const emptyTitle = game('', { releaseDate: '2027-01-01' })
    for (const { value: field } of SORT_FIELDS) {
      if (field === 'priority' || field === 'releaseStatus' || field === 'title') continue // never empty
      for (const direction of ['asc', 'desc'] as const) {
        expect(sortGames([empty, full], { field, direction }, tagsById)[1], `${field} ${direction}`).toBe(empty)
      }
    }
    for (const direction of ['asc', 'desc'] as const) {
      expect(sortGames([emptyTitle, full], { field: 'title', direction }, tagsById)[1]).toBe(emptyTitle)
    }
  })
})

describe('sortValue', () => {
  it('returns null for empty values', () => {
    const g = createEmptyGame('', 'x')
    expect(sortValue(g, 'title', tagsById)).toBeNull()
    expect(sortValue(g, 'releaseDate', tagsById)).toBeNull()
    expect(sortValue(g, 'personalStatus', tagsById)).toBeNull()
    expect(sortValue(g, 'platforms', tagsById)).toBeNull()
    expect(sortValue(g, 'tags', tagsById)).toBeNull()
    expect(sortValue(g, 'createdAt', tagsById)).toBeNull()
    expect(sortValue(g, 'priority', tagsById)).not.toBeNull()
    expect(sortValue(g, 'releaseStatus', tagsById)).not.toBeNull()
  })

  it('joins list values in sorted order', () => {
    const g = { ...createEmptyGame('', 'x'), platforms: ['Xbox', 'pc', 'Mac'], tagIds: ['t-zeta', 't-alpha'] }
    expect(sortValue(g, 'platforms', tagsById)).toBe('Mac, pc, Xbox')
    expect(sortValue(g, 'tags', tagsById)).toBe('Alpha, zeta')
  })
})
