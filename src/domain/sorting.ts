import { personalStatusMeta, priorityMeta, releaseStatusMeta } from './constants'
import { foldText } from './game'
import { releaseSortKey } from './releaseDate'
import type { Game, SortSpec, Tag } from './types'

/** A comparable value; null means "empty" and always sorts last. */
type SortValue = string | number | null

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function joinSorted(values: readonly string[]): string | null {
  if (values.length === 0) return null
  return [...values].sort(collator.compare).join(', ')
}

/**
 * The value a game is sorted by. "asc" means each field's natural order:
 * A→Z, most wanted first, earliest release first, lifecycle order, oldest first.
 */
export function sortValue(game: Game, field: SortSpec['field'], tagsById: ReadonlyMap<string, Tag>): SortValue {
  switch (field) {
    case 'title':
      return game.title || null
    case 'priority':
      // Negated so that ascending puts the most wanted first.
      return -priorityMeta(game.priority).rank
    case 'releaseDate':
      return releaseSortKey(game.releaseDate)
    case 'releaseStatus':
      return releaseStatusMeta(game.releaseStatus).rank
    case 'personalStatus':
      return game.personalStatus === 'none' ? null : personalStatusMeta(game.personalStatus).rank
    case 'platforms':
      return joinSorted(game.platforms)
    case 'genres':
      return joinSorted(game.genres)
    case 'developers':
      return joinSorted(game.developers)
    case 'publishers':
      return joinSorted(game.publishers)
    case 'tags':
      return joinSorted(
        game.tagIds.map((id) => tagsById.get(id)?.name).filter((n): n is string => Boolean(n)),
      )
    case 'createdAt':
      return game.createdAt || null
    case 'updatedAt':
      return game.updatedAt || null
  }
}

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

function compareByTitle(a: Game, b: Game): number {
  return (
    collator.compare(a.title, b.title) ||
    foldText(a.title).localeCompare(foldText(b.title)) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * Returns a new sorted array. Empty values go last in both directions;
 * ties fall back to title so the order is always stable and predictable.
 */
export function sortGames(games: readonly Game[], sort: SortSpec, tagsById: ReadonlyMap<string, Tag>): Game[] {
  const dir = sort.direction === 'desc' ? -1 : 1
  const keyed = games.map((game) => ({ game, value: sortValue(game, sort.field, tagsById) }))
  keyed.sort((x, y) => {
    if (x.value === null && y.value === null) return compareByTitle(x.game, y.game)
    if (x.value === null) return 1
    if (y.value === null) return -1
    const primary = compareValues(x.value, y.value) * dir
    if (primary !== 0) return primary
    return sort.field === 'title' ? compareByTitle(x.game, y.game) * dir : compareByTitle(x.game, y.game)
  })
  return keyed.map((k) => k.game)
}
