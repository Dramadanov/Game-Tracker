import Database from '@tauri-apps/plugin-sql'
import type { Db, SqlParam } from './Db'

/** File name inside the app config folder (%APPDATA%\io.github.dramadanov.gametracker on Windows). */
export const DB_FILE = 'gametracker.db'

/** The Tauri SQLite plugin behind the Db interface. Desktop app only. */
export class TauriDb implements Db {
  private readonly db: Database

  private constructor(db: Database) {
    this.db = db
  }

  static async open(file = DB_FILE): Promise<TauriDb> {
    return new TauriDb(await Database.load(`sqlite:${file}`))
  }

  async execute(sql: string, params: SqlParam[] = []): Promise<{ rowsAffected: number }> {
    const result = await this.db.execute(sql, params)
    return { rowsAffected: result.rowsAffected }
  }

  async select<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, params)
  }

  async close(): Promise<void> {
    await this.db.close()
  }
}
