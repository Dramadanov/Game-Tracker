import { useId, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button, CheckRow, Popover, TagChip } from '../ui'
import { PERSONAL_STATUSES, PRIORITIES, RELEASE_STATUSES, RELEASE_WINDOWS } from '../../domain/constants'
import { activeFilterCount, collectFacet, matchesReleaseWindow, type FacetValue } from '../../domain/filtering'
import { foldText } from '../../domain/game'
import type { Filters, Game, TagMatch } from '../../domain/types'
import { useToday, useVisibleGames } from '../../state/selectors'
import { useStore } from '../../state/store'
import { gamesLabel } from './filterSummary'
import './toolbar-filters.css'

/** "Filters" button with an active-count badge; opens the filter panel. */
export function FiltersButton() {
  const count = useStore((s) => activeFilterCount(s.view.filters))
  const rootRef = useRef<HTMLDivElement>(null)
  const focusTrigger = () => rootRef.current?.querySelector<HTMLButtonElement>('[data-testid="toolbar-filters"]')?.focus()

  return (
    <div className="toolbar-popover" ref={rootRef}>
      <Popover
        align="end"
        label="Filters"
        panelClassName="toolbar-fp-panel"
        trigger={({ open, toggle }) => (
          <Button
            variant="ghost"
            className={`toolbar-btn toolbar-btn-collapsible${open ? ' is-open' : ''}${count ? ' has-value' : ''}`}
            icon={<SlidersHorizontal size={16} aria-hidden="true" />}
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={count ? `Filters, ${count} active` : 'Filters'}
            title="Filters"
            data-testid="toolbar-filters"
          >
            <span className="toolbar-btn-label">Filters</span>
            {count > 0 && (
              <span className="toolbar-badge" aria-hidden="true">
                {count}
              </span>
            )}
          </Button>
        )}
      >
        {(close) => (
          <FilterPanel
            onDone={() => {
              close()
              focusTrigger()
            }}
          />
        )}
      </Popover>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toggled<T>(list: readonly T[], value: T, on: boolean): T[] {
  if (on) return list.includes(value) ? [...list] : [...list, value]
  return list.filter((v) => v !== value)
}

function toggledFolded(list: readonly string[], value: string, on: boolean): string[] {
  const rest = list.filter((v) => foldText(v) !== foldText(value))
  return on ? [...rest, value] : rest
}

function includesFolded(list: readonly string[], value: string): boolean {
  const key = foldText(value)
  return list.some((v) => foldText(v) === key)
}

function countBy(games: readonly Game[], keys: (game: Game) => readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const game of games) for (const key of keys(game)) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}

/** Facet values plus any selected values no game has anymore (so they can still be unchecked). */
function withSelected(facet: FacetValue[], selected: readonly string[]): FacetValue[] {
  const known = new Set(facet.map((f) => foldText(f.value)))
  const missing = selected.filter((s) => !known.has(foldText(s))).map((value) => ({ value, count: 0 }))
  return [...facet, ...missing]
}

// ── Panel ─────────────────────────────────────────────────────────────────

function FilterPanel({ onDone }: { onDone(): void }) {
  const games = useStore((s) => s.games)
  const tags = useStore((s) => s.tags)
  const filters = useStore((s) => s.view.filters)
  const setFilters = useStore((s) => s.setFilters)
  const visible = useVisibleGames().length
  const today = useToday()
  const windowName = useId()

  const counts = useMemo(
    () => ({
      priority: countBy(games, (g) => [g.priority]),
      releaseStatus: countBy(games, (g) => [g.releaseStatus]),
      personalStatus: countBy(games, (g) => [g.personalStatus]),
      tags: countBy(games, (g) => g.tagIds),
      window: new Map(RELEASE_WINDOWS.map((w) => [w.value, games.filter((g) => matchesReleaseWindow(g, w.value, today)).length])),
    }),
    [games, today],
  )
  const platforms = useMemo(() => withSelected(collectFacet(games, 'platforms'), filters.platforms), [games, filters.platforms])
  const genres = useMemo(() => withSelected(collectFacet(games, 'genres'), filters.genres), [games, filters.genres])

  const set = (patch: Partial<Filters>) => setFilters(patch)
  const activeCount = activeFilterCount(filters)

  return (
    <div className="toolbar-fp">
      <div className="toolbar-fp-body">
        <div className="toolbar-fp-grid">
          <Section title="Priority" onClear={filters.priorities.length ? () => set({ priorities: [] }) : undefined}>
            {PRIORITIES.map((p) => (
              <CheckRow
                key={p.value}
                checked={filters.priorities.includes(p.value)}
                onChange={(on) => set({ priorities: toggled(filters.priorities, p.value, on) })}
              >
                <span className="toolbar-fp-emoji" aria-hidden="true">
                  {p.emoji}
                </span>
                <OptionText label={p.label} count={counts.priority.get(p.value) ?? 0} />
              </CheckRow>
            ))}
          </Section>

          <Section
            title="Release status"
            onClear={filters.releaseStatuses.length ? () => set({ releaseStatuses: [] }) : undefined}
          >
            {RELEASE_STATUSES.map((s) => (
              <CheckRow
                key={s.value}
                checked={filters.releaseStatuses.includes(s.value)}
                onChange={(on) => set({ releaseStatuses: toggled(filters.releaseStatuses, s.value, on) })}
              >
                <span
                  className="toolbar-fp-dot"
                  aria-hidden="true"
                  style={{ '--toolbar-dot': `var(--status-${s.value})` } as CSSProperties}
                />
                <OptionText label={s.label} count={counts.releaseStatus.get(s.value) ?? 0} />
              </CheckRow>
            ))}
          </Section>

          <Section
            title="My status"
            onClear={filters.personalStatuses.length ? () => set({ personalStatuses: [] }) : undefined}
          >
            {PERSONAL_STATUSES.map((s) => (
              <CheckRow
                key={s.value}
                checked={filters.personalStatuses.includes(s.value)}
                onChange={(on) => set({ personalStatuses: toggled(filters.personalStatuses, s.value, on) })}
              >
                <OptionText label={s.label} count={counts.personalStatus.get(s.value) ?? 0} />
              </CheckRow>
            ))}
          </Section>

          <Section
            title="When"
            onClear={filters.releaseWindow !== 'any' ? () => set({ releaseWindow: 'any' }) : undefined}
          >
            <div role="radiogroup" aria-label="Release window" className="toolbar-fp-radios">
              {RELEASE_WINDOWS.map((w) => {
                const checked = filters.releaseWindow === w.value
                return (
                  <label key={w.value} className={`check-row toolbar-fp-radio${checked ? ' is-checked' : ''}`}>
                    <input
                      type="radio"
                      name={windowName}
                      checked={checked}
                      onChange={() => set({ releaseWindow: w.value })}
                    />
                    <span className="check-row-label">
                      <OptionText label={w.label} count={w.value === 'any' ? undefined : counts.window.get(w.value)} />
                    </span>
                  </label>
                )
              })}
            </div>
          </Section>

          <Section
            title="Platforms"
            scroll
            onClear={filters.platforms.length ? () => set({ platforms: [] }) : undefined}
          >
            {platforms.length === 0 && <Empty />}
            {platforms.map((f) => (
              <CheckRow
                key={foldText(f.value)}
                checked={includesFolded(filters.platforms, f.value)}
                onChange={(on) => set({ platforms: toggledFolded(filters.platforms, f.value, on) })}
              >
                <OptionText label={f.value} count={f.count} />
              </CheckRow>
            ))}
          </Section>

          <Section title="Genres" scroll onClear={filters.genres.length ? () => set({ genres: [] }) : undefined}>
            {genres.length === 0 && <Empty />}
            {genres.map((f) => (
              <CheckRow
                key={foldText(f.value)}
                checked={includesFolded(filters.genres, f.value)}
                onChange={(on) => set({ genres: toggledFolded(filters.genres, f.value, on) })}
              >
                <OptionText label={f.value} count={f.count} />
              </CheckRow>
            ))}
          </Section>

          <Section
            title="Tags"
            wide
            scroll
            onClear={filters.tagIds.length ? () => set({ tagIds: [] }) : undefined}
            extra={
              filters.tagIds.length >= 2 ? (
                <TagMatchToggle value={filters.tagMatch} onChange={(tagMatch) => set({ tagMatch })} />
              ) : null
            }
          >
            {tags.length === 0 && <Empty />}
            {tags.map((tag) => (
              <CheckRow
                key={tag.id}
                checked={filters.tagIds.includes(tag.id)}
                onChange={(on) => set({ tagIds: toggled(filters.tagIds, tag.id, on) })}
              >
                <span className="toolbar-fp-tag">
                  <TagChip tag={tag} size="sm" />
                </span>
                <span className="toolbar-fp-count">{counts.tags.get(tag.id) ?? 0}</span>
              </CheckRow>
            ))}
          </Section>
        </div>
      </div>

      <footer className="toolbar-fp-footer">
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw size={14} aria-hidden="true" />}
          disabled={activeCount === 0}
          onClick={(event) => {
            // Keeps the search text: this panel only owns the filters.
            setFilters({ ...resetPatch, search: filters.search })
            // This button disables itself; keep focus inside the panel so Esc still closes it.
            event.currentTarget.closest('.toolbar-fp')?.querySelector<HTMLButtonElement>('.toolbar-fp-done')?.focus()
          }}
        >
          Reset filters
        </Button>
        <span className="toolbar-fp-result" aria-live="polite">
          {activeCount || filters.search.trim() ? `${visible} of ${gamesLabel(games.length)}` : gamesLabel(games.length)}
        </span>
        <Button variant="primary" size="sm" className="toolbar-fp-done" onClick={onDone}>
          Done
        </Button>
      </footer>
    </div>
  )
}

const resetPatch: Omit<Filters, 'search'> = {
  priorities: [],
  releaseStatuses: [],
  personalStatuses: [],
  tagIds: [],
  tagMatch: 'any',
  platforms: [],
  genres: [],
  releaseWindow: 'any',
}

function Section({
  title,
  children,
  onClear,
  extra,
  scroll = false,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClear?: () => void
  extra?: ReactNode
  scroll?: boolean
  wide?: boolean
}) {
  const id = useId()
  return (
    <section className={`toolbar-fp-section${wide ? ' is-wide' : ''}`} role="group" aria-labelledby={id}>
      <div className="toolbar-fp-head">
        <h3 id={id} className="toolbar-fp-title">
          {title}
        </h3>
        {extra}
        {onClear && (
          <button type="button" className="toolbar-fp-clear" onClick={onClear} aria-label={`Clear ${title.toLowerCase()} filter`}>
            Clear
          </button>
        )}
      </div>
      <div className={`toolbar-fp-list${scroll ? ' is-scroll' : ''}`}>{children}</div>
    </section>
  )
}

function OptionText({ label, count }: { label: string; count?: number }) {
  return (
    <>
      <span className="toolbar-fp-label" title={label}>
        {label}
      </span>
      {count !== undefined && <span className="toolbar-fp-count">{count}</span>}
    </>
  )
}

function Empty() {
  return <div className="toolbar-fp-empty">None yet</div>
}

function TagMatchToggle({ value, onChange }: { value: TagMatch; onChange(value: TagMatch): void }) {
  const options: { value: TagMatch; label: string; title: string }[] = [
    { value: 'any', label: 'Any', title: 'Games with any of the selected tags' },
    { value: 'all', label: 'All', title: 'Games with all of the selected tags' },
  ]
  return (
    <div className="toolbar-fp-match" role="group" aria-label="Match tags">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`toolbar-fp-match-btn${value === o.value ? ' is-active' : ''}`}
          aria-pressed={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
