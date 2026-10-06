import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Gamepad2, Moon, Settings2, Sun, X } from 'lucide-react'
import { filterGames, type FilterContext } from '../../domain/filtering'
import type { Game, SavedView, Theme } from '../../domain/types'
import { useTagsById, useToday } from '../../state/selectors'
import { useStore, viewKey } from '../../state/store'
import { ConfirmDialog } from '../ui'
import { Count } from './Count'
import { QUICK_VIEWS, filtersEqual } from './quickViews'
import { SavedViewItem } from './SavedViewItem'
import './sidebar.css'

/** Left column: brand, library quick views, saved views, tags and the theme switch. */
export function Sidebar() {
  const games = useStore((s) => s.games)
  const tagsById = useTagsById()
  const today = useToday()
  const ctx = useMemo<FilterContext>(() => ({ tagsById, today }), [tagsById, today])

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark" aria-hidden="true">
          <Gamepad2 size={17} strokeWidth={2.2} />
        </span>
        <span className="sidebar-wordmark">Game Tracker</span>
      </div>

      <nav className="sidebar-nav" aria-label="Library views">
        <LibrarySection games={games} ctx={ctx} />
        <SavedViewsSection games={games} ctx={ctx} />
        <TagsSection games={games} />
      </nav>

      <footer className="sidebar-footer">
        <ThemeSwitch />
        <span className="sidebar-version">v0.1.0</span>
      </footer>
    </aside>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section className="sidebar-section" aria-labelledby={id}>
      <div className="sidebar-section-header">
        <h2 className="sidebar-section-title" id={id}>
          {title}
        </h2>
        {action && <div className="sidebar-section-actions">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function LibrarySection({ games, ctx }: { games: Game[]; ctx: FilterContext }) {
  const filters = useStore((s) => s.view.filters)
  const activeSavedViewId = useStore((s) => s.activeSavedViewId)
  const showAllGames = useStore((s) => s.showAllGames)
  const applyFilters = useStore((s) => s.applyFilters)

  const counts = useMemo(
    () => QUICK_VIEWS.map((q) => (q.id === 'all' ? games.length : filterGames(games, q.filters, ctx).length)),
    [games, ctx],
  )

  return (
    <Section title="Library">
      <ul className="sidebar-list">
        {QUICK_VIEWS.map((q, i) => {
          const active = activeSavedViewId === null && filtersEqual(filters, q.filters)
          const Icon = q.icon
          return (
            <li key={q.id} className={`sidebar-item${active ? ' is-active' : ''}`}>
              <button
                type="button"
                className="sidebar-item-main"
                aria-current={active ? 'true' : undefined}
                onClick={() => (q.id === 'all' ? showAllGames() : applyFilters({ ...q.filters }))}
              >
                <span className="sidebar-item-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="sidebar-item-label">{q.label}</span>
                <Count value={counts[i]} />
              </button>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function SavedViewsSection({ games, ctx }: { games: Game[]; ctx: FilterContext }) {
  const savedViews = useStore((s) => s.savedViews)
  const view = useStore((s) => s.view)
  const activeId = useStore((s) => s.activeSavedViewId)
  const deleteSavedView = useStore((s) => s.deleteSavedView)
  const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null)

  const currentKey = useMemo(() => viewKey(view), [view])
  const counts = useMemo(
    () => new Map(savedViews.map((v) => [v.id, filterGames(games, v.config.filters, ctx).length])),
    [savedViews, games, ctx],
  )

  return (
    <Section title="Saved views">
      {savedViews.length === 0 ? (
        <p className="sidebar-hint">Save filters and sorting from the toolbar to see them here.</p>
      ) : (
        <ul className="sidebar-list">
          {savedViews.map((v) => (
            <SavedViewItem
              key={v.id}
              view={v}
              count={counts.get(v.id) ?? 0}
              active={v.id === activeId}
              differs={viewKey(v.config) !== currentKey}
              onRequestDelete={setPendingDelete}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete saved view?"
        message={
          <>
            “{pendingDelete?.name}” will be removed from your saved views. Your games aren’t affected.
          </>
        }
        confirmLabel="Delete view"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete
          setPendingDelete(null)
          if (target) void deleteSavedView(target.id)
        }}
      />
    </Section>
  )
}

function TagsSection({ games }: { games: Game[] }) {
  const tags = useStore((s) => s.tags)
  const selected = useStore((s) => s.view.filters.tagIds)
  const setFilters = useStore((s) => s.setFilters)
  const setTagManagerOpen = useStore((s) => s.setTagManagerOpen)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const game of games) for (const id of game.tagIds) map.set(id, (map.get(id) ?? 0) + 1)
    return map
  }, [games])

  const toggle = (id: string) => {
    const current = useStore.getState().view.filters.tagIds
    setFilters({ tagIds: current.includes(id) ? current.filter((t) => t !== id) : [...current, id] })
  }

  return (
    <Section
      title="Tags"
      action={
        <>
          {selected.length > 0 && (
            <button
              type="button"
              className="sidebar-section-action"
              aria-label="Clear tag filter"
              title="Clear tag filter"
              onClick={() => setFilters({ tagIds: [] })}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="sidebar-section-action"
            aria-label="Manage tags"
            title="Manage tags"
            onClick={() => setTagManagerOpen(true)}
          >
            <Settings2 size={14} />
          </button>
        </>
      }
    >
      {tags.length === 0 ? (
        <p className="sidebar-hint">Create tags while editing a game, or in Manage tags.</p>
      ) : (
        <ul className="sidebar-list">
          {tags.map((tag) => {
            const isSelected = selected.includes(tag.id)
            return (
              <li
                key={tag.id}
                className={`sidebar-item sidebar-tag${isSelected ? ' is-selected' : ''}`}
                style={{ '--tag-color': tag.color } as CSSProperties}
              >
                <button
                  type="button"
                  className="sidebar-item-main"
                  aria-pressed={isSelected}
                  onClick={() => toggle(tag.id)}
                  title={isSelected ? `Stop filtering by ${tag.name}` : `Show games tagged ${tag.name}`}
                >
                  <span className="sidebar-item-icon" aria-hidden="true">
                    <span className="sidebar-tag-dot" />
                  </span>
                  <span className="sidebar-item-label">{tag.name}</span>
                  <Count value={counts.get(tag.id) ?? 0} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

const THEMES: readonly { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
]

function ThemeSwitch() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  return (
    <div className="sidebar-theme" role="group" aria-label="Theme">
      {THEMES.map((t) => {
        const active = theme === t.value
        return (
          <button
            key={t.value}
            type="button"
            className={`sidebar-theme-option${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => {
              if (!active) void setTheme(t.value)
            }}
          >
            <span className="sidebar-theme-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
