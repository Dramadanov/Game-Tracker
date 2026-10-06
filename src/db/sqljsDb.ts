import type { Database, SqlJsStatic } from 'sql.js'
import type { Db, SqlParam } from './Db'

export interface SqlJsPersistence {
  load(): Promise<Uint8Array | null>
  save(data: Uint8Array): Promise<void>
}

/**
 * sql.js (SQLite compiled to WebAssembly) behind the Db interface.
 * Used in the browser dev build and in tests; never in the desktop app.
 */
export class SqlJsDb implements Db {
  private readonly db: Database
  private readonly persistence?: SqlJsPersistence

  private constructor(db: Database, persistence?: SqlJsPersistence) {
    this.db = db
    this.persistence = persistence
    this.db.run('PRAGMA foreign_keys = ON')
  }

  static async open(SQL: SqlJsStatic, persistence?: SqlJsPersistence): Promise<SqlJsDb> {
    const data = persistence ? await persistence.load() : null
    return new SqlJsDb(data ? new SQL.Database(data) : new SQL.Database(), persistence)
  }

  async execute(sql: string, params: SqlParam[] = []): Promise<{ rowsAffected: number }> {
    this.db.run(sql, params)
    const rowsAffected = this.db.getRowsModified()
    if (this.persistence) await this.persistence.save(this.db.export())
    return { rowsAffected }
  }

  async select<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    try {
      stmt.bind(params)
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      return rows
    } finally {
      stmt.free()
    }
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
