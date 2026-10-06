import {
  RELEASE_WINDOWS,
  SORT_FIELDS,
  personalStatusMeta,
  priorityMeta,
  releaseStatusMeta,
} from '../../domain/constants'
import { foldText } from '../../domain/game'
import type { Filters, SortDirection, SortField, SortSpec, Tag, ViewConfig } from '../../domain/types'

/** One active filter value, as shown in the chips row. */
export interface ActiveFilterItem {
  key: string
  /** Faint prefix such as "Platform". Empty for priorities and tags. */
  prefix: string
  label: string
  /** Emoji shown before the label (priorities). */
  emoji?: string
  /** CSS color tinting the whole chip (priorities). */
  tint?: string
  /** CSS color for a small dot before the label (release statuses). */
  dotColor?: string
  /** Set for tag chips, rendered as a TagChip. */
  tag?: Tag
  /** Filters patch that removes only this value. */
  remove: Partial<Filters>
}

const without = <T>(list: readonly T[], value: T): T[] => list.filter((v) => v !== value)
const withoutFolded = (list: readonly string[], value: string): string[] =>
  list.filter((v) => foldText(v) !== foldText(value))

/** Every active filter value, in display order. */
export function activeFilterItems(filters: Filters, tagsById: ReadonlyMap<string, Tag>): ActiveFilterItem[] {
  const items: ActiveFilterItem[] = []

  for (const p of filters.priorities) {
    const meta = priorityMeta(p)
    items.push({
      key: `priority:${p}`,
      prefix: '',
      label: meta.label,
      emoji: meta.emoji,
      tint: `var(${meta.colorVar})`,
      remove: { priorities: without(filters.priorities, p) },
    })
  }
  for (const s of filters.releaseStatuses) {
    items.push({
      key: `status:${s}`,
      prefix: 'Status',
      label: releaseStatusMeta(s).label,
      dotColor: `var(--status-${s})`,
      remove: { releaseStatuses: without(filters.releaseStatuses, s) },
    })
  }
  for (const s of filters.personalStatuses) {
    items.push({
      key: `mine:${s}`,
      prefix: 'Mine',
      label: personalStatusMeta(s).label,
      remove: { personalStatuses: without(filters.personalStatuses, s) },
    })
  }
  if (filters.releaseWindow !== 'any') {
    items.push({
      key: 'window',
      prefix: 'When',
      label: releaseWindowLabel(filters.releaseWindow),
      remove: { releaseWindow: 'any' },
    })
  }
  for (const p of filters.platforms) {
    items.push({
      key: `platform:${foldText(p)}`,
      prefix: 'Platform',
      label: p,
      remove: { platforms: withoutFolded(filters.platforms, p) },
    })
  }
  for (const g of filters.genres) {
    items.push({
      key: `genre:${foldText(g)}`,
      prefix: 'Genre',
      label: g,
      remove: { genres: withoutFolded(filters.genres, g) },
    })
  }
  for (const id of filters.tagIds) {
    const tag = tagsById.get(id)
    if (!tag) continue
    items.push({ key: `tag:${id}`, prefix: '', label: tag.name, tag, remove: { tagIds: without(filters.tagIds, id) } })
  }
  const search = filters.search.trim()
  if (search) {
    items.push({ key: 'search', prefix: 'Search', label: `“${search}”`, remove: { search: '' } })
  }
  return items
}

export function releaseWindowLabel(value: Filters['releaseWindow']): string {
  return RELEASE_WINDOWS.find((w) => w.value === value)?.label ?? value
}

export function sortFieldLabel(field: SortField): string {
  return SORT_FIELDS.find((f) => f.value === field)?.label ?? field
}

/** Natural-language labels for both directions of a field ("asc" is each field's natural order). */
export function sortDirectionLabels(field: SortField): Record<SortDirection, string> {
  switch (field) {
    case 'priority':
      return { asc: 'Most wanted first', desc: 'Least wanted first' }
    case 'releaseDate':
      return { asc: 'Soonest first', desc: 'Latest first' }
    case 'releaseStatus':
    case 'personalStatus':
      return { asc: 'In lifecycle order', desc: 'Reverse order' }
    case 'createdAt':
    case 'updatedAt':
      return { asc: 'Oldest first', desc: 'Newest first' }
    case 'title':
    case 'platforms':
    case 'genres':
    case 'developers':
    case 'publishers':
    case 'tags':
      return { asc: 'A → Z', desc: 'Z → A' }
  }
}

/** "Release date, soonest first" */
export function describeSort(sort: SortSpec): string {
  return `${sortFieldLabel(sort.field)}, ${sortDirectionLabels(sort.field)[sort.direction].toLowerCase()}`
}

/** Short human summary of a whole view, e.g. for the save dialog. */
export function describeView(view: ViewConfig, tagsById: ReadonlyMap<string, Tag>): string[] {
  const filters = activeFilterItems(view.filters, tagsById).map((item) =>
    [item.emoji, item.prefix ? `${item.prefix}: ${item.label}` : item.label].filter(Boolean).join(' '),
  )
  return [
    filters.length ? filters.join(', ') : 'All games',
    `Sorted by ${describeSort(view.sort).replace(/^./, (c) => c.toLowerCase())}`,
    view.mode === 'grid' ? 'Grid' : 'Table',
  ]
}

/** A name suggestion built from the active filters, e.g. "Must Play · PC". Empty when nothing is filtered. */
export function suggestViewName(filters: Filters, tagsById: ReadonlyMap<string, Tag>): string {
  const parts: string[] = []
  if (filters.priorities.length === 1) parts.push(priorityMeta(filters.priorities[0]).label)
  if (filters.releaseWindow !== 'any') parts.push(releaseWindowLabel(filters.releaseWindow))
  if (filters.releaseStatuses.length === 1) parts.push(releaseStatusMeta(filters.releaseStatuses[0]).label)
  if (filters.personalStatuses.length === 1) parts.push(personalStatusMeta(filters.personalStatuses[0]).label)
  for (const id of filters.tagIds.slice(0, 2)) {
    const tag = tagsById.get(id)
    if (tag) parts.push(tag.name)
  }
  parts.push(...filters.genres.slice(0, 2), ...filters.platforms.slice(0, 2))
  return parts.slice(0, 3).join(' · ')
}

/** "1 game", "12 games". */
export function gamesLabel(n: number): string {
  return `${n} ${n === 1 ? 'game' : 'games'}`
}
