import { Ban, CalendarClock, CalendarDays, CircleCheck, CircleHelp, Library, type LucideIcon } from 'lucide-react'
import { DEFAULT_FILTERS } from '../../domain/constants'
import type { Filters } from '../../domain/types'

export interface QuickView {
  id: string
  label: string
  icon: LucideIcon
  /** Complete filter set the quick view applies (sort and mode are kept). */
  filters: Filters
}

/** The "Library" presets at the top of the sidebar. The first one shows everything. */
export const QUICK_VIEWS: readonly QuickView[] = [
  { id: 'all', label: 'All games', icon: Library, filters: DEFAULT_FILTERS },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarClock, filters: { ...DEFAULT_FILTERS, releaseWindow: 'upcoming' } },
  { id: 'next30', label: 'Next 30 days', icon: CalendarDays, filters: { ...DEFAULT_FILTERS, releaseWindow: 'next30' } },
  { id: 'released', label: 'Released', icon: CircleCheck, filters: { ...DEFAULT_FILTERS, releaseWindow: 'released' } },
  { id: 'tba', label: 'TBA', icon: CircleHelp, filters: { ...DEFAULT_FILTERS, releaseWindow: 'tba' } },
  { id: 'cancelled', label: 'Cancelled', icon: Ban, filters: { ...DEFAULT_FILTERS, releaseStatuses: ['cancelled'] } },
]

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((v) => set.has(v))
}

/**
 * Deep comparison of two filter sets, ignoring list order. The tag match mode only matters
 * when tags are selected; a whitespace-only search counts as empty.
 */
export function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.search.trim() === b.search.trim() &&
    a.releaseWindow === b.releaseWindow &&
    sameSet(a.priorities, b.priorities) &&
    sameSet(a.releaseStatuses, b.releaseStatuses) &&
    sameSet(a.personalStatuses, b.personalStatuses) &&
    sameSet(a.tagIds, b.tagIds) &&
    (a.tagIds.length === 0 || a.tagMatch === b.tagMatch) &&
    sameSet(a.platforms, b.platforms) &&
    sameSet(a.genres, b.genres)
  )
}
