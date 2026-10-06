import { create } from 'zustand'
import { Repository, sanitizeViewConfig } from '../data/repository'
import { openDatabase } from '../db'
import { DEFAULT_FILTERS, DEFAULT_VIEW, TAG_COLORS } from '../domain/constants'
import { foldText, newId, normalizeGame, validateGame } from '../domain/game'
import type {
  Filters,
  Game,
  PersonalStatus,
  Priority,
  SavedView,
  SortField,
  SortSpec,
  Tag,
  Theme,
  ViewConfig,
  ViewMode,
} from '../domain/types'

export interface Toast {
  id: string
  kind: 'error' | 'success' | 'info'
  message: string
}

/** What the editor dialog is doing: adding a new game or editing an existing one. */
export type EditorState = { mode: 'create' } | { mode: 'edit'; gameId: string } | null

export interface AppState {
  status: 'loading' | 'ready' | 'error'
  loadError: string | null

  games: Game[]
  tags: Tag[]
  savedViews: SavedView[]
  theme: Theme

  /** Current filters, sort and display mode. */
  view: ViewConfig
  /** Saved view the current view was loaded from, if any. */
  activeSavedViewId: string | null

  /** Game shown in the detail panel. */
  selectedGameId: string | null
  editor: EditorState
  tagManagerOpen: boolean
  toasts: Toast[]

  // Lifecycle
  init(): Promise<void>

  // Games
  /** Saves a new game. Returns the stored game, or null if it failed (a toast explains why). */
  createGame(draft: Game): Promise<Game | null>
  updateGame(game: Game): Promise<Game | null>
  deleteGame(id: string): Promise<boolean>
  setPriority(id: string, priority: Priority): Promise<void>
  setPersonalStatus(id: string, status: PersonalStatus): Promise<void>

  // Tags
  /** Creates a tag, or returns the existing one with the same name (case-insensitive). */
  createTag(name: string, color?: string): Promise<Tag | null>
  updateTag(tag: Tag): Promise<boolean>
  deleteTag(id: string): Promise<boolean>

  // View
  setFilters(patch: Partial<Filters>): void
  /** Replaces all filters (e.g. a sidebar quick view) and leaves any saved view. Keeps sort and mode. */
  applyFilters(filters: Filters): void
  resetFilters(): void
  setSort(sort: SortSpec): void
  /** Header-click behaviour: same field flips direction, a new field starts ascending. */
  toggleSort(field: SortField): void
  setMode(mode: ViewMode): void

  // Saved views
  saveCurrentView(name: string): Promise<SavedView | null>
  /** Overwrites a saved view with the current filters/sort/mode. */
  updateSavedView(id: string): Promise<boolean>
  renameSavedView(id: string, name: string): Promise<boolean>
  deleteSavedView(id: string): Promise<boolean>
  applySavedView(id: string): void
  /** Shows everything: default filters, keeps current sort and mode. */
  showAllGames(): void

  // Theme
  setTheme(theme: Theme): Promise<void>

  // UI
  selectGame(id: string | null): void
  openEditor(editor: EditorState): void
  closeEditor(): void
  setTagManagerOpen(open: boolean): void
  notify(kind: Toast['kind'], message: string): void
  dismissToast(id: string): void
}

let repo: Repository | null = null
let persistViewTimer: ReturnType<typeof setTimeout> | null = null

function requireRepo(): Repository {
  if (!repo) throw new Error('Database is not open yet.')
  return repo
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong.'
}

function sortedViews(views: SavedView[]): SavedView[] {
  return [...views].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

function sortedTags(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Applies the theme to <html> so CSS variables switch immediately. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

/** Stable stringify for comparing view configs. */
export function viewKey(view: ViewConfig): string {
  return JSON.stringify(view)
}

export const useStore = create<AppState>()((set, get) => {
  /** Remembers the current view so the app reopens where you left it (debounced). */
  function persistView() {
    if (persistViewTimer) clearTimeout(persistViewTimer)
    persistViewTimer = setTimeout(() => {
      persistViewTimer = null
      repo?.setSetting('lastView', get().view).catch(() => {
        /* Non-critical: the view simply won't be restored next time. */
      })
    }, 400)
  }

  function setView(view: ViewConfig) {
    set({ view })
    persistView()
  }

  function fail(prefix: string, error: unknown) {
    get().notify('error', `${prefix}: ${errorMessage(error)}`)
  }

  async function writeGame(game: Game): Promise<Game | null> {
    const problems = validateGame(game)
    if (problems.length) {
      get().notify('error', problems.join(' '))
      return null
    }
    const knownTags = new Set(get().tags.map((t) => t.id))
    const stored = normalizeGame({
      ...game,
      tagIds: game.tagIds.filter((id) => knownTags.has(id)),
    })
    await requireRepo().saveGame(stored)
    set((s) => {
      const exists = s.games.some((g) => g.id === stored.id)
      return {
        games: exists ? s.games.map((g) => (g.id === stored.id ? stored : g)) : [...s.games, stored],
      }
    })
    return stored
  }

  return {
    status: 'loading',
    loadError: null,
    games: [],
    tags: [],
    savedViews: [],
    theme: 'dark',
    view: DEFAULT_VIEW,
    activeSavedViewId: null,
    selectedGameId: null,
    editor: null,
    tagManagerOpen: false,
    toasts: [],

    async init() {
      if (get().status === 'ready') return
      set({ status: 'loading', loadError: null })
      try {
        const db = await openDatabase()
        repo = new Repository(db)
        const tags = await repo.listTags()
        const tagIds = new Set(tags.map((t) => t.id))
        const [games, savedViews, settings] = await Promise.all([
          repo.listGames(),
          repo.listSavedViews(tagIds),
          repo.getSettings(tagIds),
        ])
        applyTheme(settings.theme)
        set({
          status: 'ready',
          // Drop references to tags that no longer exist (e.g. an interrupted tag delete).
          games: games.map((g) =>
            g.tagIds.every((id) => tagIds.has(id)) ? g : { ...g, tagIds: g.tagIds.filter((id) => tagIds.has(id)) },
          ),
          tags: sortedTags(tags),
          savedViews: sortedViews(savedViews),
          theme: settings.theme,
          view: settings.lastView ?? DEFAULT_VIEW,
        })
      } catch (error) {
        set({ status: 'error', loadError: errorMessage(error) })
      }
    },

    // ── Games ──────────────────────────────────────────────────────────────

    async createGame(draft) {
      try {
        const now = new Date().toISOString()
        const exists = get().games.some((g) => g.id === draft.id)
        const game = { ...draft, id: exists || !draft.id ? newId() : draft.id, createdAt: now, updatedAt: now }
        const stored = await writeGame(game)
        if (stored) get().notify('success', `Added “${stored.title}”.`)
        return stored
      } catch (error) {
        fail('Could not add the game', error)
        return null
      }
    },

    async updateGame(game) {
      try {
        const existing = get().games.find((g) => g.id === game.id)
        if (!existing) throw new Error('That game no longer exists.')
        return await writeGame({ ...game, createdAt: existing.createdAt, updatedAt: new Date().toISOString() })
      } catch (error) {
        fail('Could not save the game', error)
        return null
      }
    },

    async deleteGame(id) {
      try {
        const game = get().games.find((g) => g.id === id)
        await requireRepo().deleteGame(id)
        set((s) => ({
          games: s.games.filter((g) => g.id !== id),
          selectedGameId: s.selectedGameId === id ? null : s.selectedGameId,
          editor: s.editor?.mode === 'edit' && s.editor.gameId === id ? null : s.editor,
        }))
        if (game) get().notify('info', `Deleted “${game.title}”.`)
        return true
      } catch (error) {
        fail('Could not delete the game', error)
        return false
      }
    },

    async setPriority(id, priority) {
      const game = get().games.find((g) => g.id === id)
      if (!game || game.priority === priority) return
      await get().updateGame({ ...game, priority })
    },

    async setPersonalStatus(id, personalStatus) {
      const game = get().games.find((g) => g.id === id)
      if (!game || game.personalStatus === personalStatus) return
      await get().updateGame({ ...game, personalStatus })
    },

    // ── Tags ───────────────────────────────────────────────────────────────

    async createTag(name, color) {
      const clean = name.replace(/\s+/g, ' ').trim()
      if (!clean) {
        get().notify('error', 'Tag name cannot be empty.')
        return null
      }
      const existing = get().tags.find((t) => foldText(t.name) === foldText(clean))
      if (existing) return existing
      try {
        const tag: Tag = {
          id: newId(),
          name: clean,
          color: color ?? TAG_COLORS[get().tags.length % TAG_COLORS.length],
          createdAt: new Date().toISOString(),
        }
        await requireRepo().saveTag(tag)
        set((s) => ({ tags: sortedTags([...s.tags, tag]) }))
        return tag
      } catch (error) {
        fail('Could not create the tag', error)
        return null
      }
    },

    async updateTag(tag) {
      const clean = tag.name.replace(/\s+/g, ' ').trim()
      if (!clean) {
        get().notify('error', 'Tag name cannot be empty.')
        return false
      }
      const clash = get().tags.find((t) => t.id !== tag.id && foldText(t.name) === foldText(clean))
      if (clash) {
        get().notify('error', `A tag named “${clash.name}” already exists.`)
        return false
      }
      try {
        const updated = { ...tag, name: clean }
        await requireRepo().saveTag(updated)
        set((s) => ({ tags: sortedTags(s.tags.map((t) => (t.id === tag.id ? updated : t))) }))
        return true
      } catch (error) {
        fail('Could not save the tag', error)
        return false
      }
    },

    async deleteTag(id) {
      try {
        const r = requireRepo()
        await r.deleteTag(id)
        const now = new Date().toISOString()
        const affected = get().games.filter((g) => g.tagIds.includes(id))
        set((s) => {
          const filters = s.view.filters
          const view = filters.tagIds.includes(id)
            ? { ...s.view, filters: { ...filters, tagIds: filters.tagIds.filter((t) => t !== id) } }
            : s.view
          return {
            tags: s.tags.filter((t) => t.id !== id),
            games: s.games.map((g) => (g.tagIds.includes(id) ? { ...g, tagIds: g.tagIds.filter((t) => t !== id) } : g)),
            view,
          }
        })
        // Clean the stored games too. If this is interrupted, init() drops dangling IDs on next start.
        for (const game of affected) {
          await r.saveGame({ ...game, tagIds: game.tagIds.filter((t) => t !== id), updatedAt: now })
        }
        // Saved views referencing the tag.
        const tagIds = new Set(get().tags.map((t) => t.id))
        const views = get().savedViews
        const cleaned = views.map((v) => ({ ...v, config: sanitizeViewConfig(v.config, tagIds) }))
        for (const [i, v] of cleaned.entries()) {
          if (viewKey(v.config) !== viewKey(views[i].config)) await r.saveView(v)
        }
        set({ savedViews: cleaned })
        persistView()
        return true
      } catch (error) {
        fail('Could not delete the tag', error)
        return false
      }
    },

    // ── View ───────────────────────────────────────────────────────────────

    setFilters(patch) {
      const { view } = get()
      setView({ ...view, filters: { ...view.filters, ...patch } })
    },

    applyFilters(filters) {
      set({ activeSavedViewId: null })
      setView({ ...get().view, filters })
    },

    resetFilters() {
      setView({ ...get().view, filters: DEFAULT_FILTERS })
    },

    setSort(sort) {
      setView({ ...get().view, sort })
    },

    toggleSort(field) {
      const { sort } = get().view
      const next: SortSpec =
        sort.field === field
          ? { field, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
          : { field, direction: 'asc' }
      setView({ ...get().view, sort: next })
    },

    setMode(mode) {
      setView({ ...get().view, mode })
    },

    // ── Saved views ────────────────────────────────────────────────────────

    async saveCurrentView(name) {
      const clean = name.replace(/\s+/g, ' ').trim()
      if (!clean) {
        get().notify('error', 'Give the view a name.')
        return null
      }
      try {
        const views = get().savedViews
        const view: SavedView = {
          id: newId(),
          name: clean,
          config: get().view,
          position: views.length ? Math.max(...views.map((v) => v.position)) + 1 : 0,
          createdAt: new Date().toISOString(),
        }
        await requireRepo().saveView(view)
        set((s) => ({ savedViews: sortedViews([...s.savedViews, view]), activeSavedViewId: view.id }))
        get().notify('success', `Saved view “${clean}”.`)
        return view
      } catch (error) {
        fail('Could not save the view', error)
        return null
      }
    },

    async updateSavedView(id) {
      const existing = get().savedViews.find((v) => v.id === id)
      if (!existing) return false
      try {
        const updated = { ...existing, config: get().view }
        await requireRepo().saveView(updated)
        set((s) => ({ savedViews: s.savedViews.map((v) => (v.id === id ? updated : v)), activeSavedViewId: id }))
        get().notify('success', `Updated view “${existing.name}”.`)
        return true
      } catch (error) {
        fail('Could not update the view', error)
        return false
      }
    },

    async renameSavedView(id, name) {
      const clean = name.replace(/\s+/g, ' ').trim()
      const existing = get().savedViews.find((v) => v.id === id)
      if (!existing || !clean) return false
      try {
        const updated = { ...existing, name: clean }
        await requireRepo().saveView(updated)
        set((s) => ({ savedViews: s.savedViews.map((v) => (v.id === id ? updated : v)) }))
        return true
      } catch (error) {
        fail('Could not rename the view', error)
        return false
      }
    },

    async deleteSavedView(id) {
      try {
        await requireRepo().deleteView(id)
        set((s) => ({
          savedViews: s.savedViews.filter((v) => v.id !== id),
          activeSavedViewId: s.activeSavedViewId === id ? null : s.activeSavedViewId,
        }))
        return true
      } catch (error) {
        fail('Could not delete the view', error)
        return false
      }
    },

    applySavedView(id) {
      const saved = get().savedViews.find((v) => v.id === id)
      if (!saved) return
      set({ activeSavedViewId: id })
      setView(saved.config)
    },

    showAllGames() {
      set({ activeSavedViewId: null })
      setView({ ...get().view, filters: DEFAULT_FILTERS })
    },

    // ── Theme ──────────────────────────────────────────────────────────────

    async setTheme(theme) {
      applyTheme(theme)
      set({ theme })
      try {
        await requireRepo().setSetting('theme', theme)
      } catch (error) {
        fail('Could not save the theme', error)
      }
    },

    // ── UI ─────────────────────────────────────────────────────────────────

    selectGame(id) {
      set({ selectedGameId: id })
    },

    openEditor(editor) {
      set({ editor })
    },

    closeEditor() {
      set({ editor: null })
    },

    setTagManagerOpen(open) {
      set({ tagManagerOpen: open })
    },

    notify(kind, message) {
      const toast: Toast = { id: newId(), kind, message }
      set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }))
      const ttl = kind === 'error' ? 8000 : 3500
      setTimeout(() => get().dismissToast(toast.id), ttl)
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },
  }
})

/**
 * Dev/test helper: replaces all data with the given games and tags (browser dev build only).
 * Exposed on window.__gameTracker in development so UI tests can seed data quickly.
 */
export async function __seedForDev(games: Game[], tags: Tag[]): Promise<void> {
  const r = requireRepo()
  for (const g of useStore.getState().games) await r.deleteGame(g.id)
  for (const t of useStore.getState().tags) await r.deleteTag(t.id)
  for (const t of tags) await r.saveTag(t)
  for (const g of games) await r.saveGame(g)
  useStore.setState({ games: games.map(normalizeGame), tags: sortedTags(tags), selectedGameId: null, editor: null })
}

/** Test hook: lets tests inject a repository backed by an in-memory database. */
export function __setRepositoryForTests(r: Repository | null): void {
  repo = r
}
