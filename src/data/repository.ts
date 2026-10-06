import type { Db } from '../db/Db'
import { DEFAULT_VIEW } from '../domain/constants'
import { sanitizeFilters } from '../domain/filtering'
import { normalizeGame } from '../domain/game'
import type {
  Game,
  GameLink,
  SavedView,
  Settings,
  SortField,
  Tag,
  Theme,
  Trailer,
  ViewConfig,
} from '../domain/types'

interface GameRow {
  id: string
  title: string
  summary: string
  cover_url: string
  release_date: string
  release_status: string
  personal_status: string
  priority: string
  platforms: string
  genres: string
  developers: string
  publishers: string
  tag_ids: string
  screenshots: string
  trailers: string
  links: string
  locked_fields: string
  external_ids: string
  created_at: string
  updated_at: string
}

interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
}

interface SavedViewRow {
  id: string
  name: string
  config: string
  position: number
  created_at: string
}

/** Parses a JSON column, falling back when the stored value is corrupt or the wrong shape. */
function parseJson<T>(value: unknown, fallback: T, guard: (v: unknown) => boolean): T {
  if (typeof value !== 'string') return fallback
  try {
    const parsed: unknown = JSON.parse(value)
    return guard(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

const isStringArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string')
const isTrailerArray = (v: unknown) =>
  Array.isArray(v) &&
  v.every((x) => x && typeof x === 'object' && typeof x.url === 'string' && typeof x.title === 'string')
const isLinkArray = (v: unknown) =>
  Array.isArray(v) &&
  v.every((x) => x && typeof x === 'object' && typeof x.url === 'string' && typeof x.label === 'string')
const isStringRecord = (v: unknown) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string')

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

export function rowToGame(row: GameRow): Game {
  return normalizeGame({
    id: str(row.id),
    title: str(row.title),
    summary: str(row.summary),
    coverUrl: str(row.cover_url),
    releaseDate: str(row.release_date),
    releaseStatus: str(row.release_status) as Game['releaseStatus'],
    personalStatus: str(row.personal_status) as Game['personalStatus'],
    priority: str(row.priority) as Game['priority'],
    platforms: parseJson<string[]>(row.platforms, [], isStringArray),
    genres: parseJson<string[]>(row.genres, [], isStringArray),
    developers: parseJson<string[]>(row.developers, [], isStringArray),
    publishers: parseJson<string[]>(row.publishers, [], isStringArray),
    tagIds: parseJson<string[]>(row.tag_ids, [], isStringArray),
    screenshots: parseJson<string[]>(row.screenshots, [], isStringArray),
    trailers: parseJson<Trailer[]>(row.trailers, [], isTrailerArray),
    links: parseJson<GameLink[]>(row.links, [], isLinkArray),
    lockedFields: parseJson<string[]>(row.locked_fields, [], isStringArray),
    externalIds: parseJson<Record<string, string>>(row.external_ids, {}, isStringRecord),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  })
}

const SORT_FIELDS: readonly SortField[] = [
  'title',
  'priority',
  'releaseDate',
  'releaseStatus',
  'personalStatus',
  'platforms',
  'genres',
  'developers',
  'publishers',
  'tags',
  'createdAt',
  'updatedAt',
]

/** Repairs a stored view config so older or hand-edited data can never break the UI. */
export function sanitizeViewConfig(raw: unknown, existingTagIds: ReadonlySet<string>): ViewConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<ViewConfig>
  const sort = (v.sort && typeof v.sort === 'object' ? v.sort : {}) as Partial<ViewConfig['sort']>
  return {
    filters: sanitizeFilters(v.filters, existingTagIds),
    sort: {
      field: SORT_FIELDS.includes(sort.field as SortField) ? (sort.field as SortField) : DEFAULT_VIEW.sort.field,
      direction: sort.direction === 'desc' ? 'desc' : 'asc',
    },
    mode: v.mode === 'table' ? 'table' : 'grid',
  }
}

/** All reads and writes of app data. Each write is a single SQL statement. */
export class Repository {
  private readonly db: Db

  constructor(db: Db) {
    this.db = db
  }

  // ── Games ────────────────────────────────────────────────────────────────

  async listGames(): Promise<Game[]> {
    const rows = await this.db.select<GameRow>('SELECT * FROM games')
    return rows.map(rowToGame)
  }

  /** Inserts or replaces the whole game row. */
  async saveGame(game: Game): Promise<void> {
    const g = normalizeGame(game)
    await this.db.execute(
      `INSERT INTO games (
        id, title, summary, cover_url, release_date, release_status, personal_status, priority,
        platforms, genres, developers, publishers, tag_ids, screenshots, trailers, links,
        locked_fields, external_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        cover_url = excluded.cover_url,
        release_date = excluded.release_date,
        release_status = excluded.release_status,
        personal_status = excluded.personal_status,
        priority = excluded.priority,
        platforms = excluded.platforms,
        genres = excluded.genres,
        developers = excluded.developers,
        publishers = excluded.publishers,
        tag_ids = excluded.tag_ids,
        screenshots = excluded.screenshots,
        trailers = excluded.trailers,
        links = excluded.links,
        locked_fields = excluded.locked_fields,
        external_ids = excluded.external_ids,
        updated_at = excluded.updated_at`,
      [
        g.id,
        g.title,
        g.summary,
        g.coverUrl,
        g.releaseDate,
        g.releaseStatus,
        g.personalStatus,
        g.priority,
        JSON.stringify(g.platforms),
        JSON.stringify(g.genres),
        JSON.stringify(g.developers),
        JSON.stringify(g.publishers),
        JSON.stringify(g.tagIds),
        JSON.stringify(g.screenshots),
        JSON.stringify(g.trailers),
        JSON.stringify(g.links),
        JSON.stringify(g.lockedFields),
        JSON.stringify(g.externalIds),
        g.createdAt,
        g.updatedAt,
      ],
    )
  }

  async deleteGame(id: string): Promise<void> {
    await this.db.execute('DELETE FROM games WHERE id = ?', [id])
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async listTags(): Promise<Tag[]> {
    const rows = await this.db.select<TagRow>('SELECT * FROM tags')
    return rows.map((r) => ({ id: str(r.id), name: str(r.name), color: str(r.color), createdAt: str(r.created_at) }))
  }

  /** Inserts or updates a tag. Throws if another tag already has the same name (case-insensitive). */
  async saveTag(tag: Tag): Promise<void> {
    await this.db.execute(
      `INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
      [tag.id, tag.name.trim(), tag.color, tag.createdAt],
    )
  }

  /**
   * Deletes a tag. Games keep the dangling ID until they are next saved; `rowToGame`
   * consumers drop unknown tag IDs, and the store rewrites affected games.
   */
  async deleteTag(id: string): Promise<void> {
    await this.db.execute('DELETE FROM tags WHERE id = ?', [id])
  }

  // ── Saved views ──────────────────────────────────────────────────────────

  async listSavedViews(existingTagIds: ReadonlySet<string>): Promise<SavedView[]> {
    const rows = await this.db.select<SavedViewRow>('SELECT * FROM saved_views ORDER BY position, created_at')
    return rows.map((r) => ({
      id: str(r.id),
      name: str(r.name),
      config: sanitizeViewConfig(parseJson<unknown>(r.config, null, () => true), existingTagIds),
      position: Number(r.position) || 0,
      createdAt: str(r.created_at),
    }))
  }

  async saveView(view: SavedView): Promise<void> {
    await this.db.execute(
      `INSERT INTO saved_views (id, name, config, position, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, config = excluded.config, position = excluded.position`,
      [view.id, view.name.trim(), JSON.stringify(view.config), view.position, view.createdAt],
    )
  }

  async deleteView(id: string): Promise<void> {
    await this.db.execute('DELETE FROM saved_views WHERE id = ?', [id])
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async getSettings(existingTagIds: ReadonlySet<string>): Promise<Settings> {
    const rows = await this.db.select<{ key: string; value: string }>('SELECT key, value FROM settings')
    const map = new Map(rows.map((r) => [str(r.key), str(r.value)]))
    const theme: Theme = map.get('theme') === 'light' ? 'light' : 'dark'
    const lastViewRaw = map.get('lastView')
    const lastView = lastViewRaw
      ? sanitizeViewConfig(parseJson<unknown>(lastViewRaw, null, () => true), existingTagIds)
      : null
    return { theme, lastView }
  }

  async setSetting(key: keyof Settings, value: unknown): Promise<void> {
    await this.db.execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, typeof value === 'string' ? value : JSON.stringify(value)],
    )
  }
}
