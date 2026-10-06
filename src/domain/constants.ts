import type {
  Filters,
  PersonalStatus,
  Priority,
  ReleaseStatus,
  ReleaseWindow,
  SortField,
  ViewConfig,
} from './types'

export interface PriorityMeta {
  value: Priority
  label: string
  emoji: string
  /** Higher = more wanted. Used for sorting. */
  rank: number
  /** CSS custom property holding this level's color. */
  colorVar: string
}

/** Ordered from most to least wanted. */
export const PRIORITIES: readonly PriorityMeta[] = [
  { value: 'must', label: 'Must Play', emoji: '🔥', rank: 5, colorVar: '--priority-must' },
  { value: 'high', label: 'High', emoji: '⭐', rank: 4, colorVar: '--priority-high' },
  { value: 'interested', label: 'Interested', emoji: '👍', rank: 3, colorVar: '--priority-interested' },
  { value: 'maybe', label: 'Maybe', emoji: '🤔', rank: 2, colorVar: '--priority-maybe' },
  { value: 'watching', label: 'Watching', emoji: '👀', rank: 1, colorVar: '--priority-watching' },
]

export interface StatusMeta<T extends string> {
  value: T
  label: string
  /** Position in the natural order. Used for sorting. */
  rank: number
}

/** Ordered along the game's lifecycle. */
export const RELEASE_STATUSES: readonly StatusMeta<ReleaseStatus>[] = [
  { value: 'rumored', label: 'Rumored', rank: 1 },
  { value: 'announced', label: 'Announced', rank: 2 },
  { value: 'early_access', label: 'Early Access', rank: 3 },
  { value: 'released', label: 'Released', rank: 4 },
  { value: 'cancelled', label: 'Cancelled', rank: 5 },
]

/** Ordered along my journey with the game. */
export const PERSONAL_STATUSES: readonly StatusMeta<PersonalStatus>[] = [
  { value: 'none', label: 'Not set', rank: 0 },
  { value: 'wishlist', label: 'Wishlist', rank: 1 },
  { value: 'preordered', label: 'Pre-ordered', rank: 2 },
  { value: 'bought', label: 'Bought', rank: 3 },
  { value: 'playing', label: 'Playing', rank: 4 },
  { value: 'finished', label: 'Finished', rank: 5 },
  { value: 'skipped', label: 'Skipped', rank: 6 },
]

export const RELEASE_WINDOWS: readonly { value: ReleaseWindow; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'thisYear', label: 'This year' },
  { value: 'nextYear', label: 'Next year' },
  { value: 'tba', label: 'TBA' },
  { value: 'released', label: 'Released' },
]

export const SORT_FIELDS: readonly { value: SortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'releaseDate', label: 'Release date' },
  { value: 'releaseStatus', label: 'Release status' },
  { value: 'personalStatus', label: 'My status' },
  { value: 'platforms', label: 'Platform' },
  { value: 'genres', label: 'Genre' },
  { value: 'developers', label: 'Developer' },
  { value: 'publishers', label: 'Publisher' },
  { value: 'tags', label: 'Tags' },
  { value: 'createdAt', label: 'Date added' },
  { value: 'updatedAt', label: 'Last edited' },
]

/** Suggested values offered in pickers; any other value can be typed in. */
export const COMMON_PLATFORMS: readonly string[] = [
  'PC',
  'PlayStation 5',
  'Xbox Series X|S',
  'Nintendo Switch 2',
  'Nintendo Switch',
  'PlayStation 4',
  'Xbox One',
  'macOS',
  'Linux',
  'Steam Deck',
  'iOS',
  'Android',
  'VR',
]

export const COMMON_GENRES: readonly string[] = [
  'Action',
  'Adventure',
  'RPG',
  'Action RPG',
  'Shooter',
  'Strategy',
  'Simulation',
  'Survival',
  'Horror',
  'Platformer',
  'Metroidvania',
  'Roguelike',
  'Puzzle',
  'Racing',
  'Sports',
  'Fighting',
  'MMO',
  'Open World',
  'Indie',
]

/** Tag colors offered in the picker. Chosen to read well on dark and light backgrounds. */
export const TAG_COLORS: readonly string[] = [
  '#e5484d',
  '#f76b15',
  '#ffb224',
  '#46a758',
  '#12a594',
  '#0090ff',
  '#3e63dd',
  '#8e4ec6',
  '#d6409f',
  '#8b8d98',
]

export const DEFAULT_FILTERS: Filters = {
  search: '',
  priorities: [],
  releaseStatuses: [],
  personalStatuses: [],
  tagIds: [],
  tagMatch: 'any',
  platforms: [],
  genres: [],
  releaseWindow: 'any',
}

export const DEFAULT_VIEW: ViewConfig = {
  filters: DEFAULT_FILTERS,
  sort: { field: 'releaseDate', direction: 'asc' },
  mode: 'grid',
}

export function priorityMeta(value: Priority): PriorityMeta {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[2]
}

export function releaseStatusMeta(value: ReleaseStatus): StatusMeta<ReleaseStatus> {
  return RELEASE_STATUSES.find((s) => s.value === value) ?? RELEASE_STATUSES[1]
}

export function personalStatusMeta(value: PersonalStatus): StatusMeta<PersonalStatus> {
  return PERSONAL_STATUSES.find((s) => s.value === value) ?? PERSONAL_STATUSES[0]
}
