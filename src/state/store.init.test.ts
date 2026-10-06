import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Repository } from '../data/repository'
import type { Db } from '../db/Db'
import { SCHEMA_VERSION, migrate } from '../db/migrations'
import { SqlJsDb } from '../db/sqljsDb'
import { DEFAULT_FILTERS, DEFAULT_VIEW } from '../domain/constants'
import { createEmptyGame } from '../domain/game'
import type { Game, ViewConfig } from '../domain/types'
import { __setRepositoryForTests, useStore } from './store'

// init() opens the real database through ../db; hand it an in-memory sql.js database instead.
const opened = vi.hoisted(() => ({ db: null as Db | null, error: null as Error | null, calls: 0 }))
vi.mock('../db', async () => {
  const { migrate: runMigrations } = await import('../db/migrations')
  return {
    openDatabase: async () => {
      opened.calls++
      if (opened.error) throw opened.error
      await runMigrations(opened.db!)
      return opened.db!
    },
  }
})

const initialState = useStore.getState()
let SQL: SqlJsStatic
let db: SqlJsDb
let documentElement: { dataset: Record<string, string>; style: Record<string, string> }

beforeAll(async () => {
  SQL = await initSqlJs()
})

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2026-10-06T10:00:00.000Z') })
  db = await SqlJsDb.open(SQL)
  opened.db = db
  opened.error = null
  opened.calls = 0
  documentElement = { dataset: {}, style: {} }
  vi.stubGlobal('document', { documentElement })
  useStore.setState(initialState, true)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  __setRepositoryForTests(null)
})

const state = () => useStore.getState()

function game(id: string, patch: Partial<Game> = {}): Game {
  return { ...createEmptyGame('2026-01-01T00:00:00.000Z', id), title: id, ...patch }
}

describe('init', () => {
  it('opens an empty database with defaults', async () => {
    await state().init()
    expect(state()).toMatchObject({
      status: 'ready',
      loadError: null,
      games: [],
      tags: [],
      savedViews: [],
      theme: 'dark',
      view: DEFAULT_VIEW,
    })
    expect(documentElement.dataset.theme).toBe('dark')
  })

  it('loads games, tags, saved views and settings', async () => {
    await migrate(db)
    const repo = new Repository(db)
    await repo.saveTag({ id: 't-z', name: 'zeta', color: '#000', createdAt: 'a' })
    await repo.saveTag({ id: 't-a', name: 'Alpha', color: '#000', createdAt: 'b' })
    await repo.saveGame(game('g1', { tagIds: ['t-a'] }))
    const lastView: ViewConfig = {
      filters: { ...DEFAULT_FILTERS, tagIds: ['t-z'], search: 'abc' },
      sort: { field: 'title', direction: 'desc' },
      mode: 'table',
    }
    await repo.saveView({ id: 'v2', name: 'Second', config: DEFAULT_VIEW, position: 2, createdAt: 'a' })
    await repo.saveView({ id: 'v1', name: 'First', config: lastView, position: 1, createdAt: 'b' })
    await repo.setSetting('theme', 'light')
    await repo.setSetting('lastView', lastView)

    await state().init()

    expect(state().status).toBe('ready')
    expect(state().games).toEqual([game('g1', { tagIds: ['t-a'] })])
    expect(state().tags.map((t) => t.name)).toEqual(['Alpha', 'zeta'])
    expect(state().savedViews.map((v) => v.id)).toEqual(['v1', 'v2'])
    expect(state().savedViews[0].config).toEqual(lastView)
    expect(state().theme).toBe('light')
    expect(state().view).toEqual(lastView)
    expect(documentElement.dataset.theme).toBe('light')
    expect(documentElement.style.colorScheme).toBe('light')
  })

  it('drops references to tags that no longer exist', async () => {
    await migrate(db)
    const repo = new Repository(db)
    await repo.saveTag({ id: 'kept', name: 'Kept', color: '#000', createdAt: 'a' })
    await repo.saveGame(game('g1', { tagIds: ['kept', 'deleted'] }))
    await repo.saveGame(game('g2', { tagIds: ['kept'] }))
    await repo.saveView({
      id: 'v',
      name: 'V',
      config: { ...DEFAULT_VIEW, filters: { ...DEFAULT_FILTERS, tagIds: ['deleted', 'kept'] } },
      position: 0,
      createdAt: 'a',
    })
    await repo.setSetting('lastView', { ...DEFAULT_VIEW, filters: { ...DEFAULT_FILTERS, tagIds: ['deleted'] } })

    await state().init()

    expect(state().games.map((g) => g.tagIds)).toEqual([['kept'], ['kept']])
    expect(state().savedViews[0].config.filters.tagIds).toEqual(['kept'])
    expect(state().view.filters.tagIds).toEqual([])
  })

  it('makes the store usable for writes', async () => {
    await state().init()
    const created = await state().createGame(game('new'))
    expect(created).not.toBeNull()
    expect(await new Repository(db).listGames()).toEqual([created])
  })

  it('does nothing when already ready', async () => {
    await state().init()
    const games = state().games
    opened.error = new Error('should not be opened again')
    await state().init()
    expect(state().status).toBe('ready')
    expect(state().games).toBe(games)
  })

  it('opens the database only once when called twice at the same time (React StrictMode)', async () => {
    await Promise.all([state().init(), state().init()])
    expect(opened.calls).toBe(1)
    expect(state().status).toBe('ready')
  })

  it('can be retried after a failure', async () => {
    opened.error = new Error('locked')
    await state().init()
    expect(state().status).toBe('error')
    opened.error = null
    await state().init()
    expect(state()).toMatchObject({ status: 'ready', loadError: null })
  })

  it('reports a database that cannot be opened', async () => {
    opened.error = new Error('disk on fire')
    await state().init()
    expect(state()).toMatchObject({ status: 'error', loadError: 'disk on fire' })
  })

  it('refuses a database from a newer app version', async () => {
    await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
    await state().init()
    expect(state().status).toBe('error')
    expect(state().loadError).toMatch(/newer version of Game Tracker/)
  })
})
