import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIGRATIONS, SCHEMA_VERSION, getSchemaVersion, migrate } from './migrations'
import { SqlJsDb } from './sqljsDb'

let SQL: SqlJsStatic
let db: SqlJsDb

beforeAll(async () => {
  SQL = await initSqlJs()
})

beforeEach(async () => {
  db = await SqlJsDb.open(SQL)
})

async function tableNames(): Promise<string[]> {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  return rows.map((r) => r.name)
}

describe('migrate', () => {
  it('has at least one migration and SCHEMA_VERSION matches', () => {
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length)
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('creates the schema on a fresh database and sets user_version', async () => {
    expect(await getSchemaVersion(db)).toBe(0)
    await migrate(db)
    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION)
    expect(await tableNames()).toEqual(['games', 'saved_views', 'settings', 'tags'])
  })

  it('is a no-op when run again', async () => {
    await migrate(db)
    await db.execute("INSERT INTO settings (key, value) VALUES ('theme', 'light')")
    const execute = vi.spyOn(db, 'execute')
    await migrate(db)
    expect(execute).not.toHaveBeenCalled()
    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION)
    expect(await db.select('SELECT * FROM settings')).toEqual([{ key: 'theme', value: 'light' }])
  })

  it('refuses a database created by a newer app version, without touching it', async () => {
    await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
    const execute = vi.spyOn(db, 'execute')
    await expect(migrate(db)).rejects.toThrow(`newer version of Game Tracker (schema v${SCHEMA_VERSION + 1})`)
    expect(execute).not.toHaveBeenCalled()
    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION + 1)
    expect(await tableNames()).toEqual([])
  })

  it('finishes a migration that was interrupted halfway', async () => {
    // Simulate a crash after the first statement of v1 ran but before user_version was bumped.
    await db.execute(MIGRATIONS[0][0])
    expect(await getSchemaVersion(db)).toBe(0)
    await migrate(db)
    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION)
    expect(await tableNames()).toEqual(['games', 'saved_views', 'settings', 'tags'])
  })

  it('applies column defaults for games', async () => {
    await migrate(db)
    await db.execute("INSERT INTO games (id, title, created_at, updated_at) VALUES ('g', 'T', 'c', 'u')")
    const [row] = await db.select<Record<string, unknown>>('SELECT * FROM games')
    expect(row).toMatchObject({
      summary: '',
      cover_url: '',
      release_date: '',
      release_status: 'announced',
      personal_status: 'none',
      priority: 'interested',
      platforms: '[]',
      tag_ids: '[]',
      external_ids: '{}',
    })
  })

  it('enforces case-insensitive unique tag names', async () => {
    await migrate(db)
    await db.execute("INSERT INTO tags (id, name, color, created_at) VALUES ('a', 'Co-op', '#fff', 'c')")
    await expect(
      db.execute("INSERT INTO tags (id, name, color, created_at) VALUES ('b', 'co-op', '#fff', 'c')"),
    ).rejects.toThrow(/UNIQUE/)
  })
})

describe('getSchemaVersion', () => {
  it('reads PRAGMA user_version as a number', async () => {
    await db.execute('PRAGMA user_version = 7')
    expect(await getSchemaVersion(db)).toBe(7)
  })
})
