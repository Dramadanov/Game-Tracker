import { LayoutGrid, Plus, Rows3 } from 'lucide-react'
import { Button, IconButton } from '../ui'
import { isDefaultFilters } from '../../domain/filtering'
import { useVisibleGames } from '../../state/selectors'
import { useStore, viewKey } from '../../state/store'
import { ActiveFilterChips } from './ActiveFilterChips'
import { FiltersButton } from './FilterPanel'
import { SaveViewButton } from './SaveView'
import { SearchBox } from './SearchBox'
import { SortMenu } from './SortMenu'
import { gamesLabel } from './filterSummary'
import './toolbar.css'

/** Bar above the library: context heading, search, filters, sort, layout, save view and add game. */
export function Toolbar() {
  const openEditor = useStore((s) => s.openEditor)

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <ToolbarHeading />
        <SearchBox />
        <div className="toolbar-actions">
          <div className="toolbar-group">
            <FiltersButton />
            <SortMenu />
          </div>
          <ViewModeToggle />
          <SaveViewButton />
          <Button
            variant="primary"
            className="toolbar-add"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => openEditor({ mode: 'create' })}
            title="Add game (Ctrl+N)"
            aria-keyshortcuts="Control+N"
            data-testid="toolbar-add-game"
          >
            Add game
          </Button>
        </div>
      </div>
      <ActiveFilterChips />
    </header>
  )
}

/** Saved view name (or "Library") plus a game count. */
function ToolbarHeading() {
  const total = useStore((s) => s.games.length)
  const view = useStore((s) => s.view)
  const active = useStore((s) => s.savedViews.find((v) => v.id === s.activeSavedViewId))
  const filtered = !isDefaultFilters(view.filters)
  const edited = active ? viewKey(active.config) !== viewKey(view) : false
  const visible = useVisibleGames().length
  const title = active?.name ?? 'Library'

  return (
    <div className="toolbar-heading">
      <div className="toolbar-title-line">
        <h1 className="toolbar-title" title={title}>
          {title}
        </h1>
        {edited && (
          <span className="toolbar-edited" title="Changed since this view was saved">
            · edited
          </span>
        )}
      </div>
      <span className="toolbar-count" aria-live="polite" aria-atomic="true">
        {filtered ? `${visible} of ${gamesLabel(total)}` : gamesLabel(total)}
      </span>
    </div>
  )
}

function ViewModeToggle() {
  const mode = useStore((s) => s.view.mode)
  const setMode = useStore((s) => s.setMode)
  return (
    <div className="toolbar-segmented" role="group" aria-label="Layout">
      <IconButton
        size="sm"
        className="toolbar-seg-btn"
        label="Grid view"
        icon={<LayoutGrid size={16} />}
        active={mode === 'grid'}
        onClick={() => setMode('grid')}
        data-testid="toolbar-mode-grid"
      />
      <IconButton
        size="sm"
        className="toolbar-seg-btn"
        label="Table view"
        icon={<Rows3 size={16} />}
        active={mode === 'table'}
        onClick={() => setMode('table')}
        data-testid="toolbar-mode-table"
      />
    </div>
  )
}
