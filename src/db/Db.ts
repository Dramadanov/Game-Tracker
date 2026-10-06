/** Positional parameters. Use `?` placeholders — both drivers support them. */
export type SqlParam = string | number | null

/**
 * The minimal SQL interface the app needs. Implemented by the Tauri SQLite plugin
 * (desktop app) and by sql.js (browser dev mode and tests).
 *
 * Note: the desktop driver uses a connection pool, so multi-statement transactions are
 * not reliable. Keep each logical write to a single statement where it matters.
 */
export interface Db {
  execute(sql: string, params?: SqlParam[]): Promise<{ rowsAffected: number }>
  select<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>
  close(): Promise<void>
}
