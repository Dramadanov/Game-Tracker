import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { SqlJsDb, type SqlJsPersistence } from './sqljsDb'

let SQL: SqlJsStatic

beforeAll(async () => {
  SQL = await initSqlJs()
})

function memoryPersistence(): SqlJsPersistence & { data: Uint8Array | null; saves: number } {
  return {
    data: null,
    saves: 0,
    async load() {
      return this.data
    },
    async save(data) {
      this.data = data
      this.saves++
    },
  }
}

describe('SqlJsDb', () => {
  it('executes statements with positional parameters and reports affected rows', async () => {
    const db = await SqlJsDb.open(SQL)
    await db.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n REAL)')
    expect(await db.execute('INSERT INTO t (name, n) VALUES (?, ?), (?, ?)', ['a', 1.5, 'b', null])).toEqual({
      rowsAffected: 2,
    })
    expect(await db.execute('UPDATE t SET n = ? WHERE name = ?', [3, 'b'])).toEqual({ rowsAffected: 1 })
    expect(await db.execute('DELETE FROM t WHERE name = ?', ['missing'])).toEqual({ rowsAffected: 0 })
    expect(await db.select('SELECT name, n FROM t ORDER BY id')).toEqual([
      { name: 'a', n: 1.5 },
      { name: 'b', n: 3 },
    ])
    expect(await db.select('SELECT name FROM t WHERE name = ?', ['b'])).toEqual([{ name: 'b' }])
    expect(await db.select('SELECT name FROM t WHERE name = ?', ['zzz'])).toEqual([])
    await db.close()
  })

  it('binds strings literally (no SQL injection through parameters)', async () => {
    const db = await SqlJsDb.open(SQL)
    await db.execute('CREATE TABLE t (name TEXT)')
    const evil = "x'); DROP TABLE t; --"
    await db.execute('INSERT INTO t (name) VALUES (?)', [evil])
    expect(await db.select('SELECT name FROM t')).toEqual([{ name: evil }])
  })

  it('rejects (rather than throwing synchronously) on SQL errors', async () => {
    const db = await SqlJsDb.open(SQL)
    const pending = db.execute('NOT SQL')
    expect(pending).toBeInstanceOf(Promise)
    await expect(pending).rejects.toThrow()
    await expect(db.select('SELECT * FROM missing_table')).rejects.toThrow(/no such table/)
  })

  it('saves after every write and restores from persistence', async () => {
    const persistence = memoryPersistence()
    const first = await SqlJsDb.open(SQL, persistence)
    expect(persistence.saves).toBe(0)
    await first.execute('CREATE TABLE t (v TEXT)')
    await first.execute("INSERT INTO t VALUES ('kept')")
    expect(persistence.saves).toBe(2)
    expect(persistence.data).toBeInstanceOf(Uint8Array)
    await first.close()

    const second = await SqlJsDb.open(SQL, persistence)
    expect(await second.select('SELECT v FROM t')).toEqual([{ v: 'kept' }])
  })

  it('does not save on reads', async () => {
    const persistence = memoryPersistence()
    const db = await SqlJsDb.open(SQL, persistence)
    await db.select('SELECT 1 AS one')
    expect(persistence.saves).toBe(0)
  })
})
