import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Repository } from '../data/repository'
import { migrate } from '../db/migrations'
import { SqlJsDb } from '../db/sqljsDb'
import { DEFAULT_FILTERS, DEFAULT_VIEW, TAG_COLORS } from '../domain/constants'
import { createEmptyGame, normalizeGame, validateGame } from '../domain/game'
import { SAMPLE_TAGS, sampleGames } from '../dev/sampleData'
import type { Game, Tag, ViewConfig } from '../domain/types'
import { __seedForDev, __setRepositoryForTests, useStore, viewKey } from './store'

const T0 = '2026-10-06T10:00:00.000Z'
const initialState = useStore.getState()

let SQL: SqlJsStatic
let db: SqlJsDb
let repo: Repository

beforeAll(async () => {
  SQL = await initSqlJs()
})

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(T0) })
  db = await SqlJsDb.open(SQL)
  await migrate(db)
  repo = new Repository(db)
  __setRepositoryForTests(repo)
  useStore.setState(initialState, true)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  __setRepositoryForTests(null)
})

const state = () => useStore.getState()
const lastToast = () => state().toasts.at(-1)

function draft(patch: Partial<Game> = {}): Game {
  return { ...createEmptyGame('1999-01-01T00:00:00.000Z', 'draft-id'), title: 'New Game', ...patch }
}

/** Advances the fake clock so the next write gets a later timestamp. */
function tick(ms = 60_000): string {
  vi.advanceTimersByTime(ms)
  return new Date().toISOString()
}

async function addGame(patch: Partial<Game> = {}): Promise<Game> {
  const g = await state().createGame(draft({ id: '', ...patch }))
  if (!g) throw new Error(`createGame failed: ${lastToast()?.message}`)
  return g
}

async function addTag(name: string, color?: string): Promise<Tag> {
  const t = await state().createTag(name, color)
  if (!t) throw new Error(`createTag failed: ${lastToast()?.message}`)
  return t
}

async function dbGame(id: string): Promise<Game | undefined> {
  return (await repo.listGames()).find((g) => g.id === id)
}

/** Saved views as stored, without dropping unknown tags (to see what is really on disk). */
async function rawSavedViews(): Promise<{ id: string; config: ViewConfig }[]> {
  const rows = await db.select<{ id: string; config: string }>('SELECT id, config FROM saved_views ORDER BY position')
  return rows.map((r) => ({ id: r.id, config: JSON.parse(r.config) as ViewConfig }))
}

// ── Games ──────────────────────────────────────────────────────────────────

describe('createGame', () => {
  it('stores a normalized game with fresh timestamps, in memory and in the database', async () => {
    const created = await state().createGame(
      draft({ title: '  Hollow   Knight ', platforms: ['PC', 'pc'], createdAt: 'x', updatedAt: 'y' }),
    )
    expect(created).not.toBeNull()
    expect(created!.title).toBe('Hollow Knight')
    expect(created!.platforms).toEqual(['PC'])
    expect(created!.createdAt).toBe(T0)
    expect(created!.updatedAt).toBe(T0)
    expect(state().games).toEqual([created])
    expect(await repo.listGames()).toEqual([created])
    expect(lastToast()).toMatchObject({ kind: 'success', message: 'Added “Hollow Knight”.' })
  })

  it('keeps the draft id when it is free', async () => {
    const created = await state().createGame(draft({ id: 'my-id' }))
    expect(created!.id).toBe('my-id')
  })

  it('assigns a new id when the draft has none or it is already taken', async () => {
    const a = await state().createGame(draft({ id: 'same' }))
    const b = await state().createGame(draft({ id: 'same', title: 'Second' }))
    const c = await state().createGame(draft({ id: '', title: 'Third' }))
    expect(a!.id).toBe('same')
    expect(b!.id).not.toBe('same')
    expect(c!.id).not.toBe('')
    expect(new Set([a!.id, b!.id, c!.id]).size).toBe(3)
    expect((await repo.listGames()).find((g) => g.id === 'same')?.title).toBe('New Game')
    expect(state().games).toHaveLength(3)
  })

  it('rejects an empty title with an error toast and stores nothing', async () => {
    expect(await state().createGame(draft({ title: '   ' }))).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Title is required.' })
    expect(state().games).toEqual([])
    expect(await repo.listGames()).toEqual([])
  })

  it('rejects an invalid release date', async () => {
    expect(await state().createGame(draft({ releaseDate: '2027-02-30' }))).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Release date is not valid.' })
    expect(await repo.listGames()).toEqual([])
  })

  it('drops unknown tag ids', async () => {
    const tag = await addTag('Co-op')
    const created = await state().createGame(draft({ tagIds: ['ghost', tag.id] }))
    expect(created!.tagIds).toEqual([tag.id])
    expect((await dbGame(created!.id))!.tagIds).toEqual([tag.id])
  })

  it('reports a database failure instead of throwing', async () => {
    __setRepositoryForTests(null)
    expect(await state().createGame(draft())).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Could not add the game: Database is not open yet.' })
    expect(state().games).toEqual([])
  })
})

describe('updateGame', () => {
  it('keeps createdAt, bumps updatedAt and persists', async () => {
    const g = await addGame({ title: 'Before' })
    const later = tick()
    const updated = await state().updateGame({ ...g, title: 'After', createdAt: 'tampered', updatedAt: 'tampered' })
    expect(updated).toMatchObject({ title: 'After', createdAt: T0, updatedAt: later })
    expect(state().games).toEqual([updated])
    expect(await dbGame(g.id)).toEqual(updated)
  })

  it('drops unknown tag ids', async () => {
    const tag = await addTag('Co-op')
    const g = await addGame({ tagIds: [tag.id] })
    const updated = await state().updateGame({ ...g, tagIds: [tag.id, 'ghost', tag.id] })
    expect(updated!.tagIds).toEqual([tag.id])
    expect((await dbGame(g.id))!.tagIds).toEqual([tag.id])
  })

  it('rejects an empty title and leaves the game unchanged', async () => {
    const g = await addGame({ title: 'Keep me' })
    expect(await state().updateGame({ ...g, title: '' })).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Title is required.' })
    expect(state().games).toEqual([g])
    expect(await dbGame(g.id)).toEqual(g)
  })

  it('refuses to update a game that no longer exists (and does not re-create it)', async () => {
    const g = await addGame()
    await state().deleteGame(g.id)
    expect(await state().updateGame({ ...g, title: 'Zombie' })).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Could not save the game: That game no longer exists.' })
    expect(state().games).toEqual([])
    expect(await repo.listGames()).toEqual([])
  })

  it('keeps the position of the game in the list', async () => {
    const a = await addGame({ title: 'A' })
    const b = await addGame({ title: 'B' })
    const c = await addGame({ title: 'C' })
    await state().updateGame({ ...b, title: 'B2' })
    expect(state().games.map((g) => g.id)).toEqual([a.id, b.id, c.id])
  })
})

describe('setPriority / setPersonalStatus', () => {
  it('update and persist the field', async () => {
    const g = await addGame({ priority: 'maybe', personalStatus: 'none' })
    tick()
    await state().setPriority(g.id, 'must')
    await state().setPersonalStatus(g.id, 'wishlist')
    expect(state().games[0]).toMatchObject({ priority: 'must', personalStatus: 'wishlist' })
    expect(await dbGame(g.id)).toMatchObject({ priority: 'must', personalStatus: 'wishlist' })
  })

  it('do nothing when the value is unchanged or the game is unknown', async () => {
    const g = await addGame({ priority: 'high', personalStatus: 'bought' })
    tick()
    await state().setPriority(g.id, 'high')
    await state().setPersonalStatus(g.id, 'bought')
    await state().setPriority('missing', 'must')
    expect(state().games).toEqual([g])
    expect(await dbGame(g.id)).toEqual(g)
  })
})

describe('deleteGame', () => {
  it('removes the game from memory and the database', async () => {
    const a = await addGame({ title: 'A' })
    const b = await addGame({ title: 'B' })
    expect(await state().deleteGame(a.id)).toBe(true)
    expect(state().games).toEqual([b])
    expect(await repo.listGames()).toEqual([b])
    expect(lastToast()).toMatchObject({ kind: 'info', message: 'Deleted “A”.' })
  })

  it('clears the selection and closes the editor for that game', async () => {
    const g = await addGame()
    state().selectGame(g.id)
    state().openEditor({ mode: 'edit', gameId: g.id })
    await state().deleteGame(g.id)
    expect(state().selectedGameId).toBeNull()
    expect(state().editor).toBeNull()
  })

  it('leaves the selection and editor of other games alone', async () => {
    const a = await addGame({ title: 'A' })
    const b = await addGame({ title: 'B' })
    state().selectGame(b.id)
    state().openEditor({ mode: 'edit', gameId: b.id })
    await state().deleteGame(a.id)
    expect(state().selectedGameId).toBe(b.id)
    expect(state().editor).toEqual({ mode: 'edit', gameId: b.id })

    state().openEditor({ mode: 'create' })
    await state().deleteGame(b.id)
    expect(state().editor).toEqual({ mode: 'create' })
  })

  it('reports a database failure and keeps the game', async () => {
    const g = await addGame()
    __setRepositoryForTests(null)
    expect(await state().deleteGame(g.id)).toBe(false)
    expect(state().games).toEqual([g])
    expect(lastToast()?.kind).toBe('error')
  })
})

// ── Tags ───────────────────────────────────────────────────────────────────

describe('createTag', () => {
  it('trims and collapses the name, picks a palette color and persists', async () => {
    const tag = await state().createTag('  Couch   co-op ')
    expect(tag).toMatchObject({ name: 'Couch co-op', color: TAG_COLORS[0], createdAt: T0 })
    expect(state().tags).toEqual([tag])
    expect(await repo.listTags()).toEqual([tag])
  })

  it('cycles through the palette and honours an explicit color', async () => {
    const a = await addTag('A')
    const b = await addTag('B')
    const c = await addTag('C', '#123456')
    expect([a.color, b.color, c.color]).toEqual([TAG_COLORS[0], TAG_COLORS[1], '#123456'])
  })

  it('keeps tags sorted by name, case-insensitively', async () => {
    await addTag('zeta')
    await addTag('Alpha')
    await addTag('beta')
    expect(state().tags.map((t) => t.name)).toEqual(['Alpha', 'beta', 'zeta'])
  })

  it('rejects an empty name', async () => {
    expect(await state().createTag('   ')).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Tag name cannot be empty.' })
    expect(await repo.listTags()).toEqual([])
  })

  it('returns the existing tag for a case-insensitive duplicate', async () => {
    const first = await addTag('Co-op')
    const again = await state().createTag(' CO-OP ')
    expect(again).toBe(first)
    expect(state().tags).toHaveLength(1)
    expect(await repo.listTags()).toHaveLength(1)
  })
})

describe('updateTag', () => {
  it('renames and recolors, trimming the name, and persists', async () => {
    const tag = await addTag('Co-op')
    expect(await state().updateTag({ ...tag, name: '  Local   co-op ', color: '#000000' })).toBe(true)
    const expected = { ...tag, name: 'Local co-op', color: '#000000' }
    expect(state().tags).toEqual([expected])
    expect(await repo.listTags()).toEqual([expected])
  })

  it('re-sorts tags after a rename', async () => {
    const a = await addTag('Alpha')
    await addTag('Mid')
    await state().updateTag({ ...a, name: 'Zulu' })
    expect(state().tags.map((t) => t.name)).toEqual(['Mid', 'Zulu'])
  })

  it('allows changing the case of its own name', async () => {
    const tag = await addTag('co-op')
    expect(await state().updateTag({ ...tag, name: 'Co-op' })).toBe(true)
    expect((await repo.listTags())[0].name).toBe('Co-op')
  })

  it('rejects a name used by another tag (case-insensitive)', async () => {
    await addTag('Co-op')
    const solo = await addTag('Solo')
    expect(await state().updateTag({ ...solo, name: 'CO-OP' })).toBe(false)
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'A tag named “Co-op” already exists.' })
    expect(state().tags.find((t) => t.id === solo.id)?.name).toBe('Solo')
    expect((await repo.listTags()).find((t) => t.id === solo.id)?.name).toBe('Solo')
  })

  it('rejects an empty name', async () => {
    const tag = await addTag('Co-op')
    expect(await state().updateTag({ ...tag, name: ' ' })).toBe(false)
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Tag name cannot be empty.' })
    expect(state().tags).toEqual([tag])
  })

  it('does not resurrect a tag that was deleted meanwhile', async () => {
    const tag = await addTag('Co-op')
    await state().deleteTag(tag.id)
    expect(await state().updateTag({ ...tag, name: 'Renamed' })).toBe(false)
    expect(lastToast()?.kind).toBe('error')
    expect(state().tags).toEqual([])
    expect(await repo.listTags()).toEqual([])
  })
})

describe('deleteTag', () => {
  it('removes the tag everywhere: tags, games (memory and database), filters and saved views', async () => {
    const coop = await addTag('Co-op')
    const story = await addTag('Story')
    const both = await addGame({ title: 'Both', tagIds: [coop.id, story.id] })
    const onlyCoop = await addGame({ title: 'Only co-op', tagIds: [coop.id] })
    const none = await addGame({ title: 'None', tagIds: [story.id] })

    // A saved view filtering on both tags, one on the other tag only, and the current filters.
    state().setFilters({ tagIds: [coop.id, story.id], tagMatch: 'all' })
    const withBoth = await state().saveCurrentView('Both tags')
    state().setFilters({ tagIds: [story.id] })
    const storyOnly = await state().saveCurrentView('Story only')
    state().applySavedView(withBoth!.id)

    tick()
    expect(await state().deleteTag(coop.id)).toBe(true)

    // Tags
    expect(state().tags).toEqual([story])
    expect(await repo.listTags()).toEqual([story])

    // Games, in memory and in the database, and both agree.
    expect(state().games.map((g) => g.tagIds)).toEqual([[story.id], [], [story.id]])
    for (const g of state().games) expect(await dbGame(g.id)).toEqual(g)
    expect(state().games.find((g) => g.id === none.id)).toEqual(none)
    expect(both.id && onlyCoop.id).toBeTruthy()

    // Current filters
    expect(state().view.filters.tagIds).toEqual([story.id])
    expect(state().view.filters.tagMatch).toBe('all')

    // Saved views, in memory and on disk
    expect(state().savedViews.find((v) => v.id === withBoth!.id)!.config.filters.tagIds).toEqual([story.id])
    expect(state().savedViews.find((v) => v.id === storyOnly!.id)!.config.filters.tagIds).toEqual([story.id])
    const raw = await rawSavedViews()
    expect(raw.map((v) => v.config.filters.tagIds)).toEqual([[story.id], [story.id]])

    // Still on the same saved view, and it is not shown as edited.
    expect(state().activeSavedViewId).toBe(withBoth!.id)
    expect(viewKey(state().savedViews.find((v) => v.id === withBoth!.id)!.config)).toBe(viewKey(state().view))
  })

  it('works when nothing uses the tag', async () => {
    const tag = await addTag('Unused')
    const g = await addGame()
    expect(await state().deleteTag(tag.id)).toBe(true)
    expect(state().tags).toEqual([])
    expect(state().games).toEqual([g])
  })

  it('persists the cleaned current view', async () => {
    const tag = await addTag('Co-op')
    state().setFilters({ tagIds: [tag.id] })
    await vi.advanceTimersByTimeAsync(1000)
    await state().deleteTag(tag.id)
    await vi.advanceTimersByTimeAsync(1000)
    const settings = await repo.getSettings(new Set([tag.id]))
    expect(settings.lastView?.filters.tagIds).toEqual([])
  })
})

// ── View ───────────────────────────────────────────────────────────────────

describe('view', () => {
  it('starts from the default view', () => {
    expect(state().view).toEqual(DEFAULT_VIEW)
  })

  it('setFilters merges a patch and keeps the active saved view', async () => {
    const saved = await state().saveCurrentView('Mine')
    state().setFilters({ search: 'abc' })
    state().setFilters({ priorities: ['must'] })
    expect(state().view.filters).toEqual({ ...DEFAULT_FILTERS, search: 'abc', priorities: ['must'] })
    expect(state().activeSavedViewId).toBe(saved!.id)
  })

  it('applyFilters replaces all filters, keeps sort and mode, and leaves the saved view', async () => {
    state().setSort({ field: 'title', direction: 'desc' })
    state().setMode('table')
    state().setFilters({ search: 'abc', genres: ['RPG'] })
    await state().saveCurrentView('Mine')
    const quick = { ...DEFAULT_FILTERS, releaseWindow: 'upcoming' as const }
    state().applyFilters(quick)
    expect(state().view).toEqual({ filters: quick, sort: { field: 'title', direction: 'desc' }, mode: 'table' })
    expect(state().activeSavedViewId).toBeNull()
  })

  it('resetFilters restores the default filters and keeps sort and mode', () => {
    state().setSort({ field: 'priority', direction: 'asc' })
    state().setMode('table')
    state().setFilters({ search: 'x', tagMatch: 'all', releaseWindow: 'tba' })
    state().resetFilters()
    expect(state().view).toEqual({ filters: DEFAULT_FILTERS, sort: { field: 'priority', direction: 'asc' }, mode: 'table' })
  })

  it('toggleSort flips the direction of the same field and starts a new field ascending', () => {
    expect(state().view.sort).toEqual({ field: 'releaseDate', direction: 'asc' })
    state().toggleSort('releaseDate')
    expect(state().view.sort).toEqual({ field: 'releaseDate', direction: 'desc' })
    state().toggleSort('releaseDate')
    expect(state().view.sort).toEqual({ field: 'releaseDate', direction: 'asc' })
    state().toggleSort('releaseDate')
    state().toggleSort('title')
    expect(state().view.sort).toEqual({ field: 'title', direction: 'asc' })
    state().toggleSort('title')
    expect(state().view.sort).toEqual({ field: 'title', direction: 'desc' })
    state().toggleSort('priority')
    expect(state().view.sort).toEqual({ field: 'priority', direction: 'asc' })
  })

  it('toggleSort keeps filters and mode', () => {
    state().setFilters({ search: 'q' })
    state().setMode('table')
    state().toggleSort('tags')
    expect(state().view.filters.search).toBe('q')
    expect(state().view.mode).toBe('table')
  })

  it('setMode switches between grid and table', () => {
    state().setMode('table')
    expect(state().view.mode).toBe('table')
    state().setMode('grid')
    expect(state().view.mode).toBe('grid')
  })

  it('remembers the latest view in the database after a short debounce', async () => {
    const execute = vi.spyOn(db, 'execute')
    state().setFilters({ search: 'a' })
    state().setFilters({ search: 'ab' })
    state().setMode('table')
    expect((await repo.getSettings(new Set())).lastView).toBeNull()
    await vi.advanceTimersByTimeAsync(399)
    expect((await repo.getSettings(new Set())).lastView).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(execute).toHaveBeenCalledTimes(1)
    expect((await repo.getSettings(new Set())).lastView).toEqual({
      ...DEFAULT_VIEW,
      filters: { ...DEFAULT_FILTERS, search: 'ab' },
      mode: 'table',
    })
  })
})

// ── Saved views ────────────────────────────────────────────────────────────

describe('saved views', () => {
  const tableByTitle: Partial<ViewConfig> = { sort: { field: 'title', direction: 'desc' }, mode: 'table' }

  it('saveCurrentView stores the current view, trims the name and makes it active', async () => {
    state().setFilters({ priorities: ['must'] })
    state().setSort(tableByTitle.sort!)
    const view = await state().saveCurrentView('  Must   plays ')
    expect(view).toMatchObject({ name: 'Must plays', position: 0, createdAt: T0, config: state().view })
    expect(state().savedViews).toEqual([view])
    expect(state().activeSavedViewId).toBe(view!.id)
    expect(await repo.listSavedViews(new Set())).toEqual([view])
    expect(lastToast()?.kind).toBe('success')
  })

  it('saveCurrentView rejects an empty name', async () => {
    expect(await state().saveCurrentView('  ')).toBeNull()
    expect(lastToast()).toMatchObject({ kind: 'error' })
    expect(await repo.listSavedViews(new Set())).toEqual([])
  })

  it('appends new views at the end', async () => {
    const a = await state().saveCurrentView('A')
    const b = await state().saveCurrentView('B')
    await state().deleteSavedView(a!.id)
    const c = await state().saveCurrentView('C')
    expect([a!.position, b!.position, c!.position]).toEqual([0, 1, 2])
    expect(state().savedViews.map((v) => v.name)).toEqual(['B', 'C'])
  })

  it('updateSavedView overwrites the config with the current view and persists', async () => {
    const saved = await state().saveCurrentView('Mine')
    state().showAllGames()
    state().setFilters({ genres: ['RPG'] })
    state().setMode('table')
    expect(await state().updateSavedView(saved!.id)).toBe(true)
    const expected = { ...saved!, config: state().view }
    expect(state().savedViews).toEqual([expected])
    expect(state().activeSavedViewId).toBe(saved!.id)
    expect(await repo.listSavedViews(new Set())).toEqual([expected])
  })

  it('updateSavedView returns false for an unknown view', async () => {
    expect(await state().updateSavedView('missing')).toBe(false)
    expect(await repo.listSavedViews(new Set())).toEqual([])
  })

  it('renameSavedView trims, persists and refuses empty names or unknown views', async () => {
    const saved = await state().saveCurrentView('Old')
    expect(await state().renameSavedView(saved!.id, '  New   name ')).toBe(true)
    expect(state().savedViews[0].name).toBe('New name')
    expect((await repo.listSavedViews(new Set()))[0].name).toBe('New name')
    expect(await state().renameSavedView(saved!.id, '   ')).toBe(false)
    expect(await state().renameSavedView('missing', 'X')).toBe(false)
    expect((await repo.listSavedViews(new Set()))[0].name).toBe('New name')
  })

  it('deleteSavedView removes the view and leaves it if it was active', async () => {
    const a = await state().saveCurrentView('A')
    const b = await state().saveCurrentView('B')
    expect(state().activeSavedViewId).toBe(b!.id)
    expect(await state().deleteSavedView(a!.id)).toBe(true)
    expect(state().activeSavedViewId).toBe(b!.id)
    expect(await state().deleteSavedView(b!.id)).toBe(true)
    expect(state().activeSavedViewId).toBeNull()
    expect(state().savedViews).toEqual([])
    expect(await repo.listSavedViews(new Set())).toEqual([])
  })

  it('applySavedView loads the saved filters, sort and mode and marks it active', async () => {
    state().setFilters({ search: 'saved' })
    state().setSort(tableByTitle.sort!)
    state().setMode('table')
    const saved = await state().saveCurrentView('Saved')
    state().showAllGames()
    state().setSort({ field: 'priority', direction: 'asc' })
    state().setMode('grid')
    expect(state().activeSavedViewId).toBeNull()

    state().applySavedView(saved!.id)
    expect(state().view).toEqual(saved!.config)
    expect(state().activeSavedViewId).toBe(saved!.id)
  })

  it('applySavedView ignores unknown ids', async () => {
    const saved = await state().saveCurrentView('Saved')
    state().setFilters({ search: 'x' })
    const before = state().view
    state().applySavedView('missing')
    expect(state().view).toBe(before)
    expect(state().activeSavedViewId).toBe(saved!.id)
  })

  it('showAllGames resets filters, keeps sort and mode, and leaves the saved view', async () => {
    state().setFilters({ search: 'x', priorities: ['must'] })
    state().setSort(tableByTitle.sort!)
    state().setMode('table')
    await state().saveCurrentView('Saved')
    state().showAllGames()
    expect(state().view).toEqual({ filters: DEFAULT_FILTERS, sort: tableByTitle.sort, mode: 'table' })
    expect(state().activeSavedViewId).toBeNull()
  })

  it('reports database failures', async () => {
    const saved = await state().saveCurrentView('Saved')
    __setRepositoryForTests(null)
    expect(await state().saveCurrentView('Another')).toBeNull()
    expect(await state().updateSavedView(saved!.id)).toBe(false)
    expect(await state().renameSavedView(saved!.id, 'Renamed')).toBe(false)
    expect(await state().deleteSavedView(saved!.id)).toBe(false)
    expect(state().savedViews).toEqual([saved])
    expect(state().toasts.every((t) => t.kind === 'error')).toBe(true)
  })
})

describe('viewKey', () => {
  it('is equal for equal configs', () => {
    expect(viewKey(structuredClone(DEFAULT_VIEW))).toBe(viewKey(DEFAULT_VIEW))
  })

  it('does not depend on key order', () => {
    const f = DEFAULT_FILTERS
    const reordered = {
      mode: 'grid',
      sort: { direction: 'asc', field: 'releaseDate' },
      filters: {
        releaseWindow: f.releaseWindow,
        genres: f.genres,
        platforms: f.platforms,
        tagMatch: f.tagMatch,
        tagIds: f.tagIds,
        personalStatuses: f.personalStatuses,
        releaseStatuses: f.releaseStatuses,
        priorities: f.priorities,
        search: f.search,
      },
    } as ViewConfig
    expect(viewKey(reordered)).toBe(viewKey(DEFAULT_VIEW))
  })

  it('differs when anything differs', () => {
    const base = viewKey(DEFAULT_VIEW)
    expect(viewKey({ ...DEFAULT_VIEW, mode: 'table' })).not.toBe(base)
    expect(viewKey({ ...DEFAULT_VIEW, sort: { field: 'releaseDate', direction: 'desc' } })).not.toBe(base)
    expect(viewKey({ ...DEFAULT_VIEW, filters: { ...DEFAULT_FILTERS, search: ' ' } })).not.toBe(base)
    expect(viewKey({ ...DEFAULT_VIEW, filters: { ...DEFAULT_FILTERS, tagIds: ['a'] } })).not.toBe(base)
  })
})

// ── Theme ──────────────────────────────────────────────────────────────────

describe('setTheme', () => {
  it('applies the theme to the document and persists it', async () => {
    const documentElement = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
    vi.stubGlobal('document', { documentElement })
    await state().setTheme('light')
    expect(state().theme).toBe('light')
    expect(documentElement.dataset.theme).toBe('light')
    expect(documentElement.style.colorScheme).toBe('light')
    expect((await repo.getSettings(new Set())).theme).toBe('light')
    await state().setTheme('dark')
    expect((await repo.getSettings(new Set())).theme).toBe('dark')
  })
})

// ── UI state and toasts ────────────────────────────────────────────────────

describe('UI state', () => {
  it('tracks selection, editor and tag manager', () => {
    state().selectGame('g1')
    expect(state().selectedGameId).toBe('g1')
    state().selectGame(null)
    expect(state().selectedGameId).toBeNull()
    state().openEditor({ mode: 'create' })
    expect(state().editor).toEqual({ mode: 'create' })
    state().closeEditor()
    expect(state().editor).toBeNull()
    state().setTagManagerOpen(true)
    expect(state().tagManagerOpen).toBe(true)
    state().setTagManagerOpen(false)
    expect(state().tagManagerOpen).toBe(false)
  })
})

describe('toasts', () => {
  it('keeps at most four toasts, newest last', () => {
    for (let i = 1; i <= 6; i++) state().notify('info', `#${i}`)
    expect(state().toasts.map((t) => t.message)).toEqual(['#3', '#4', '#5', '#6'])
  })

  it('dismisses toasts automatically, errors staying longer', () => {
    state().notify('success', 'saved')
    state().notify('error', 'failed')
    vi.advanceTimersByTime(3500)
    expect(state().toasts.map((t) => t.message)).toEqual(['failed'])
    vi.advanceTimersByTime(4500)
    expect(state().toasts).toEqual([])
  })

  it('dismissToast removes one toast', () => {
    state().notify('info', 'a')
    state().notify('info', 'b')
    state().dismissToast(state().toasts[0].id)
    expect(state().toasts.map((t) => t.message)).toEqual(['b'])
  })
})

describe('__seedForDev', () => {
  it('replaces all games and tags, in memory and in the database', async () => {
    await addTag('Old tag')
    const old = await addGame({ title: 'Old game' })
    state().selectGame(old.id)
    const games = sampleGames('2026-10-06')
    // The sample library is valid and already clean.
    for (const g of games) {
      expect(validateGame(g), g.title).toEqual([])
      expect(normalizeGame(g), g.title).toEqual(g)
    }
    await __seedForDev(games, SAMPLE_TAGS)
    expect(state().games.map((g) => g.id)).toEqual(games.map((g) => g.id))
    expect(state().tags.map((t) => t.id).sort()).toEqual(SAMPLE_TAGS.map((t) => t.id).sort())
    expect(state().selectedGameId).toBeNull()
    const stored = await repo.listGames()
    expect(stored).toHaveLength(games.length)
    for (const g of state().games) expect(stored.find((s) => s.id === g.id)).toEqual(g)
    expect(await repo.listTags()).toHaveLength(SAMPLE_TAGS.length)

    await __seedForDev([], [])
    expect(state().games).toEqual([])
    expect(await repo.listGames()).toEqual([])
    expect(await repo.listTags()).toEqual([])
  })
})
