import type { Db } from './Db'

/**
 * Schema migrations, applied in order. Each entry moves the database from version
 * `index` to `index + 1` (tracked in `PRAGMA user_version`).
 *
 * Rules: never edit a released migration — append a new one. Every statement must be
 * safe to re-run (IF NOT EXISTS) so a migration interrupted halfway can simply run again.
 */
export const MIGRATIONS: readonly (readonly string[])[] = [
  // v1 — Phase 1 core
  [
    `CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      release_date TEXT NOT NULL DEFAULT '',
      release_status TEXT NOT NULL DEFAULT 'announced',
      personal_status TEXT NOT NULL DEFAULT 'none',
      priority TEXT NOT NULL DEFAULT 'interested',
      platforms TEXT NOT NULL DEFAULT '[]',
      genres TEXT NOT NULL DEFAULT '[]',
      developers TEXT NOT NULL DEFAULT '[]',
      publishers TEXT NOT NULL DEFAULT '[]',
      tag_ids TEXT NOT NULL DEFAULT '[]',
      screenshots TEXT NOT NULL DEFAULT '[]',
      trailers TEXT NOT NULL DEFAULT '[]',
      links TEXT NOT NULL DEFAULT '[]',
      locked_fields TEXT NOT NULL DEFAULT '[]',
      external_ids TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique ON tags (name COLLATE NOCASE)`,
    `CREATE TABLE IF NOT EXISTS saved_views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
]

export const SCHEMA_VERSION = MIGRATIONS.length

export async function getSchemaVersion(db: Db): Promise<number> {
  const rows = await db.select<{ user_version: number }>('PRAGMA user_version')
  return Number(rows[0]?.user_version ?? 0)
}

/** Brings the database up to SCHEMA_VERSION. Refuses to open a database from a newer app version. */
export async function migrate(db: Db): Promise<void> {
  const current = await getSchemaVersion(db)
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `This database was created by a newer version of Game Tracker (schema v${current}). ` +
        `Please update the app.`,
    )
  }
  for (let version = current; version < SCHEMA_VERSION; version++) {
    for (const statement of MIGRATIONS[version]) {
      await db.execute(statement)
    }
    // PRAGMA does not accept bound parameters; the value is a trusted integer.
    await db.execute(`PRAGMA user_version = ${version + 1}`)
  }
}
