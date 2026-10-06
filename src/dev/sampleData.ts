/**
 * Fictional sample library for development and automated UI tests.
 * Not shipped to users as data: it is only reachable through the dev hook in main.tsx.
 * Dates are relative to "today" so the sample never goes stale.
 */
import { createEmptyGame } from '../domain/game'
import { addDays } from '../domain/releaseDate'
import type { Game, Priority, ReleaseStatus, PersonalStatus, Tag } from '../domain/types'

export const SAMPLE_TAGS: Tag[] = [
  { id: 'tag-coop', name: 'Co-op', color: '#12a594', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'tag-story', name: 'Story-rich', color: '#8e4ec6', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'tag-day1', name: 'Day one', color: '#e5484d', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'tag-sale', name: 'Wait for sale', color: '#ffb224', createdAt: '2026-01-01T00:00:00.000Z' },
]

interface Spec {
  title: string
  date: (y: number, today: string) => string
  status: ReleaseStatus
  priority: Priority
  personal?: PersonalStatus
  platforms: string[]
  genres: string[]
  developers: string[]
  publishers: string[]
  tags?: string[]
  summary?: string
}

const SPECS: Spec[] = [
  {
    title: 'Starfall Odyssey',
    date: (_y, t) => addDays(t, 12),
    status: 'announced',
    priority: 'must',
    personal: 'preordered',
    platforms: ['PC', 'PlayStation 5', 'Xbox Series X|S'],
    genres: ['RPG', 'Open World'],
    developers: ['Nebula Forge'],
    publishers: ['Orbit Interactive'],
    tags: ['tag-story', 'tag-day1'],
    summary: 'A sprawling space RPG about a crew of smugglers caught between two collapsing empires.',
  },
  {
    title: 'Hollow Lantern',
    date: (y) => `${y + 1}-Q2`,
    status: 'announced',
    priority: 'high',
    personal: 'wishlist',
    platforms: ['PC', 'Nintendo Switch 2'],
    genres: ['Metroidvania', 'Indie'],
    developers: ['Moth & Candle'],
    publishers: ['Moth & Candle'],
    tags: ['tag-day1'],
    summary: 'Hand-drawn metroidvania set in a city lit only by lanterns.',
  },
  {
    title: 'Iron Tide Tactics',
    date: (y) => `${y + 1}`,
    status: 'announced',
    priority: 'interested',
    platforms: ['PC'],
    genres: ['Strategy'],
    developers: ['Bastion Works'],
    publishers: ['Northwind Games'],
    tags: ['tag-sale'],
  },
  {
    title: 'Neon Drift Rally',
    date: (_y, t) => t.slice(0, 7),
    status: 'announced',
    priority: 'maybe',
    platforms: ['PC', 'PlayStation 5'],
    genres: ['Racing'],
    developers: ['Velocity Lab'],
    publishers: ['Orbit Interactive'],
  },
  {
    title: 'Echoes of Ashvale',
    date: () => '',
    status: 'announced',
    priority: 'high',
    platforms: ['PC', 'PlayStation 5', 'Xbox Series X|S'],
    genres: ['Action RPG'],
    developers: ['Greywater Studio'],
    publishers: ['Northwind Games'],
    tags: ['tag-story'],
    summary: 'Dark fantasy action RPG. Only a teaser so far.',
  },
  {
    title: 'Campfire Crew',
    date: (_y, t) => addDays(t, -40),
    status: 'released',
    priority: 'interested',
    personal: 'playing',
    platforms: ['PC', 'Nintendo Switch'],
    genres: ['Survival'],
    developers: ['Little Ember'],
    publishers: ['Little Ember'],
    tags: ['tag-coop'],
  },
  {
    title: 'Project Kestrel',
    date: () => '',
    status: 'rumored',
    priority: 'watching',
    platforms: [],
    genres: ['Shooter'],
    developers: ['Talon Entertainment'],
    publishers: [],
  },
  {
    title: 'Sunken Kingdoms',
    date: (y) => `${y + 1}-03`,
    status: 'early_access',
    priority: 'interested',
    personal: 'bought',
    platforms: ['PC'],
    genres: ['Strategy', 'Simulation'],
    developers: ['Coral Systems'],
    publishers: ['Coral Systems'],
    tags: ['tag-coop'],
  },
  {
    title: 'Last Signal',
    date: (y) => `${y}-Q4`,
    status: 'cancelled',
    priority: 'maybe',
    platforms: ['PC', 'Xbox Series X|S'],
    genres: ['Horror'],
    developers: ['Static Room'],
    publishers: ['Northwind Games'],
  },
  {
    title: 'Pixel Pantry',
    date: (_y, t) => addDays(t, 25),
    status: 'announced',
    priority: 'watching',
    platforms: ['PC', 'Nintendo Switch 2', 'iOS'],
    genres: ['Simulation', 'Indie'],
    developers: ['Crumb Games'],
    publishers: ['Crumb Games'],
    tags: ['tag-coop', 'tag-sale'],
  },
  {
    title: 'Blade of the Ninth Moon',
    date: (y) => `${y + 2}`,
    status: 'announced',
    priority: 'must',
    platforms: ['PlayStation 5', 'PC'],
    genres: ['Action', 'Adventure'],
    developers: ['Kurogane'],
    publishers: ['Orbit Interactive'],
    tags: ['tag-story', 'tag-day1'],
  },
  {
    title: 'Ötzi: Frozen Trails',
    date: (y) => `${y + 1}-11-14`,
    status: 'announced',
    priority: 'interested',
    platforms: ['PC'],
    genres: ['Adventure', 'Survival'],
    developers: ['Alpenglow'],
    publishers: ['Alpenglow'],
  },
]

export function sampleGames(today: string): Game[] {
  const year = Number(today.slice(0, 4))
  return SPECS.map((spec, i) => {
    const created = new Date(Date.UTC(year, 0, 1 + i)).toISOString()
    return {
      ...createEmptyGame(created, `sample-${i + 1}`),
      title: spec.title,
      summary: spec.summary ?? '',
      releaseDate: spec.date(year, today),
      releaseStatus: spec.status,
      personalStatus: spec.personal ?? 'none',
      priority: spec.priority,
      platforms: spec.platforms,
      genres: spec.genres,
      developers: spec.developers,
      publishers: spec.publishers,
      tagIds: spec.tags ?? [],
      trailers: i === 0 ? [{ title: 'Announcement trailer', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' }] : [],
      links: i === 0 ? [{ label: 'Official site', url: 'https://example.com/starfall' }] : [],
    }
  })
}
