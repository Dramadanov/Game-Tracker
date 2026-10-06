import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { TextInput } from '../ui'
import { useStore } from '../../state/store'

/** Library search, bound to view.filters.search. App.tsx focuses it on Ctrl+F and "/". */
export function SearchBox() {
  const search = useStore((s) => s.view.filters.search)
  const setFilters = useStore((s) => s.setFilters)
  const rootRef = useRef<HTMLDivElement>(null)

  const clear = () => {
    setFilters({ search: '' })
    rootRef.current?.querySelector('input')?.focus()
  }

  return (
    <div className="toolbar-search" role="search" ref={rootRef}>
      <Search className="toolbar-search-icon" size={16} aria-hidden="true" />
      <TextInput
        id="search-input"
        type="search"
        className="toolbar-search-input"
        placeholder="Search games, studios, tags…"
        aria-label="Search games"
        title="Search (Ctrl+F or /)"
        autoComplete="off"
        spellCheck={false}
        value={search}
        onChange={(event) => setFilters({ search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          if (search) {
            // Consumed: don't also close panels that listen for Esc globally.
            event.stopPropagation()
            setFilters({ search: '' })
          } else {
            event.currentTarget.blur()
          }
        }}
      />
      {search ? (
        <button type="button" className="toolbar-search-clear" onClick={clear} aria-label="Clear search" title="Clear search (Esc)">
          <X size={14} />
        </button>
      ) : (
        <kbd className="toolbar-kbd" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  )
}
