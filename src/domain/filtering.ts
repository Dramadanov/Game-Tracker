import {
  DEFAULT_FILTERS,
  PERSONAL_STATUSES,
  PRIORITIES,
  RELEASE_STATUSES,
  RELEASE_WINDOWS,
  personalStatusMeta,
  priorityMeta,
  releaseStatusMeta,
} from './constants'
import { foldText } from './game'
import { addDays, parseReleaseDate, releaseDateRange } from './releaseDate'
import type { Filters, Game, PersonalStatus, Priority, ReleaseStatus, ReleaseWindow, Tag } from './types'

export interface FilterContext {
  tagsById: ReadonlyMap<string, Tag>
  /** 'YYYY-MM-DD' in local time. */
  today: string
}

/** Text a search query is matched against. */
function searchHaystack(game: Game, tagsById: ReadonlyMap<string, Tag>): string {
  return foldText(
    [
      game.title,
      ...game.developers,
      ...game.publishers,
      ...game.genres,
      ...game.platforms,
      ...game.tagIds.map((id) => tagsById.get(id)?.name ?? ''),
      priorityMeta(game.priority).label,
      releaseStatusMeta(game.releaseStatus).label,
      game.personalStatus === 'none' ? '' : personalStatusMeta(game.personalStatus).label,
    ].join(' \u0000 '),
  )
}

const notOut = (game: Game) => game.releaseStatus !== 'released' && game.releaseStatus !== 'cancelled'

export function matchesReleaseWindow(game: Game, window: ReleaseWindow, today: string): boolean {
  if (window === 'any') return true
  if (window === 'released') return game.releaseStatus === 'released'
  if (window === 'tba') return game.releaseDate.trim() === ''

  const range = releaseDateRange(game.releaseDate)
  const thisYear = Number(today.slice(0, 4))
  switch (window) {
    case 'upcoming':
      // Not out yet and not dated in the past (TBA counts as upcoming).
      return notOut(game) && (range === null || range.end >= today)
    case 'next30': {
      if (!notOut(game) || !range) return false
      const precision = parseReleaseDate(game.releaseDate)?.precision
      // Only reasonably precise dates; "Q4" or "2026" are too vague for a 30-day window.
      if (precision !== 'day' && precision !== 'month') return false
      return range.end >= today && range.start <= addDays(today, 30)
    }
    case 'thisYear':
      return range !== null && Number(range.start.slice(0, 4)) === thisYear
    case 'nextYear':
      return range !== null && Number(range.start.slice(0, 4)) === thisYear + 1
  }
}

function hasAnyFolded(values: readonly string[], wanted: readonly string[]): boolean {
  if (wanted.length === 0) return true
  const set = new Set(values.map(foldText))
  return wanted.some((w) => set.has(foldText(w)))
}

export function matchesFilters(game: Game, filters: Filters, ctx: FilterContext): boolean {
  if (filters.priorities.length && !filters.priorities.includes(game.priority)) return false
  if (filters.releaseStatuses.length && !filters.releaseStatuses.includes(game.releaseStatus)) return false
  if (filters.personalStatuses.length && !filters.personalStatuses.includes(game.personalStatus)) return false

  if (filters.tagIds.length) {
    const has = (id: string) => game.tagIds.includes(id)
    const ok = filters.tagMatch === 'all' ? filters.tagIds.every(has) : filters.tagIds.some(has)
    if (!ok) return false
  }

  if (!hasAnyFolded(game.platforms, filters.platforms)) return false
  if (!hasAnyFolded(game.genres, filters.genres)) return false
  if (!matchesReleaseWindow(game, filters.releaseWindow, ctx.today)) return false

  const words = foldText(filters.search).split(/\s+/).filter(Boolean)
  if (words.length) {
    const haystack = searchHaystack(game, ctx.tagsById)
    if (!words.every((w) => haystack.includes(w))) return false
  }
  return true
}

export function filterGames(games: readonly Game[], filters: Filters, ctx: FilterContext): Game[] {
  return games.filter((g) => matchesFilters(g, filters, ctx))
}

/** Number of active filter groups, excluding the search box (shown on the Filters button). */
export function activeFilterCount(filters: Filters): number {
  let n = 0
  if (filters.priorities.length) n++
  if (filters.releaseStatuses.length) n++
  if (filters.personalStatuses.length) n++
  if (filters.tagIds.length) n++
  if (filters.platforms.length) n++
  if (filters.genres.length) n++
  if (filters.releaseWindow !== 'any') n++
  return n
}

export function isDefaultFilters(filters: Filters): boolean {
  return activeFilterCount(filters) === 0 && filters.search.trim() === ''
}

/**
 * Repairs filters loaded from storage (older versions, hand edits): fills missing keys
 * and drops tag IDs that no longer exist.
 */
export function sanitizeFilters(raw: unknown, existingTagIds: ReadonlySet<string>): Filters {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Partial<Filters>
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    search: typeof f.search === 'string' ? f.search : DEFAULT_FILTERS.search,
    priorities: arr<Priority>(f.priorities).filter((v) => PRIORITIES.some((p) => p.value === v)),
    releaseStatuses: arr<ReleaseStatus>(f.releaseStatuses).filter((v) => RELEASE_STATUSES.some((s) => s.value === v)),
    personalStatuses: arr<PersonalStatus>(f.personalStatuses).filter((v) => PERSONAL_STATUSES.some((s) => s.value === v)),
    tagIds: arr<string>(f.tagIds).filter((id) => existingTagIds.has(id)),
    tagMatch: f.tagMatch === 'all' ? 'all' : 'any',
    platforms: arr<string>(f.platforms).filter((v) => typeof v === 'string'),
    genres: arr<string>(f.genres).filter((v) => typeof v === 'string'),
    releaseWindow: RELEASE_WINDOWS.some((w) => w.value === f.releaseWindow)
      ? f.releaseWindow!
      : DEFAULT_FILTERS.releaseWindow,
  }
}

export interface FacetValue {
  value: string
  count: number
}

/**
 * Distinct values of a list field across games (case-insensitive, first spelling wins),
 * sorted by count then name. Feeds filter menus and autocomplete.
 */
export function collectFacet(
  games: readonly Game[],
  field: 'platforms' | 'genres' | 'developers' | 'publishers',
): FacetValue[] {
  const byKey = new Map<string, FacetValue>()
  for (const game of games) {
    for (const value of game[field]) {
      const key = foldText(value)
      const entry = byKey.get(key)
      if (entry) entry.count++
      else byKey.set(key, { value, count: 1 })
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}
