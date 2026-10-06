/** Interest level, from most to least wanted. */
export type Priority = 'must' | 'high' | 'interested' | 'maybe' | 'watching'

/** The game's official state, as announced by its makers. */
export type ReleaseStatus = 'rumored' | 'announced' | 'early_access' | 'released' | 'cancelled'

/** Where the game stands for me personally. */
export type PersonalStatus =
  | 'none'
  | 'wishlist'
  | 'preordered'
  | 'bought'
  | 'playing'
  | 'finished'
  | 'skipped'

export interface Trailer {
  title: string
  url: string
}

export interface GameLink {
  label: string
  url: string
}

/**
 * Release date with its precision encoded in the string format:
 *   ''            → TBA (unknown)
 *   'YYYY'        → year
 *   'YYYY-Qn'     → quarter (n = 1..4)
 *   'YYYY-MM'     → month
 *   'YYYY-MM-DD'  → exact day
 * See `releaseDate.ts` for parsing, formatting and sorting.
 */
export type ReleaseDate = string

export interface Game {
  id: string
  title: string
  summary: string
  coverUrl: string
  releaseDate: ReleaseDate
  releaseStatus: ReleaseStatus
  personalStatus: PersonalStatus
  priority: Priority
  platforms: string[]
  genres: string[]
  developers: string[]
  publishers: string[]
  tagIds: string[]
  screenshots: string[]
  trailers: Trailer[]
  links: GameLink[]
  /** Field names auto-refresh must never overwrite (used from Phase 2). */
  lockedFields: string[]
  /** IDs in external databases, e.g. { igdb: '1942', steam: '292030' } (used from Phase 2). */
  externalIds: Record<string, string>
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  /** CSS color, e.g. '#7c5cff'. */
  color: string
  createdAt: string
}

export type ViewMode = 'grid' | 'table'

export type SortField =
  | 'title'
  | 'priority'
  | 'releaseDate'
  | 'releaseStatus'
  | 'personalStatus'
  | 'platforms'
  | 'genres'
  | 'developers'
  | 'publishers'
  | 'tags'
  | 'createdAt'
  | 'updatedAt'

export type SortDirection = 'asc' | 'desc'

export interface SortSpec {
  field: SortField
  direction: SortDirection
}

/** Which part of the release timeline to show. */
export type ReleaseWindow =
  | 'any'
  | 'upcoming'
  | 'next30'
  | 'thisYear'
  | 'nextYear'
  | 'tba'
  | 'released'

export type TagMatch = 'any' | 'all'

export interface Filters {
  search: string
  priorities: Priority[]
  releaseStatuses: ReleaseStatus[]
  personalStatuses: PersonalStatus[]
  tagIds: string[]
  tagMatch: TagMatch
  platforms: string[]
  genres: string[]
  releaseWindow: ReleaseWindow
}

export interface ViewConfig {
  filters: Filters
  sort: SortSpec
  mode: ViewMode
}

export interface SavedView {
  id: string
  name: string
  config: ViewConfig
  position: number
  createdAt: string
}

export type Theme = 'dark' | 'light'

export interface Settings {
  theme: Theme
  /** The view (filters + sort + mode) to restore on startup. */
  lastView: ViewConfig | null
}
