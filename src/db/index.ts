import { isTauri } from '@tauri-apps/api/core'
import type { Db } from './Db'
import { migrate } from './migrations'

export type { Db, SqlParam } from './Db'

const BROWSER_STORAGE_KEY = 'game-tracker.db.v1'

/** True when running inside the desktop app (as opposed to the browser dev build). */
export function inDesktopApp(): boolean {
  return isTauri()
}

/** Browser dev build: keep the sql.js database in localStorage so data survives reloads. */
async function openBrowserDb(): Promise<Db> {
  const [{ default: initSqlJs }, { default: wasmUrl }, { SqlJsDb }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
    import('./sqljsDb'),
  ])
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  return SqlJsDb.open(SQL, {
    async load() {
      try {
        const stored = localStorage.getItem(BROWSER_STORAGE_KEY)
        if (!stored) return null
        return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
      } catch {
        return null
      }
    },
    async save(data) {
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < data.length; i += chunk) {
        binary += String.fromCharCode(...data.subarray(i, i + chunk))
      }
      localStorage.setItem(BROWSER_STORAGE_KEY, btoa(binary))
    },
  })
}

/** Opens the right database for the current environment and applies migrations. */
export async function openDatabase(): Promise<Db> {
  const db = inDesktopApp()
    ? await (await import('./tauriDb')).TauriDb.open()
    : await openBrowserDb()
  await migrate(db)
  return db
}
