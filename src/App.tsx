import { useEffect } from 'react'
import { Gamepad2, Plus, RotateCw, SearchX } from 'lucide-react'
import './App.css'
import { GameDetail } from './components/detail/GameDetail'
import { GameEditor } from './components/editor/GameEditor'
import { GameGrid } from './components/library/GameGrid'
import { GameTable } from './components/library/GameTable'
import { Sidebar } from './components/sidebar/Sidebar'
import { TagManager } from './components/tags/TagManager'
import { Toolbar } from './components/toolbar/Toolbar'
import { Button, Toasts } from './components/ui'
import { useVisibleGames } from './state/selectors'
import { useStore } from './state/store'

/** Global shortcuts: Ctrl+N adds a game, Ctrl+F or "/" focuses search. */
function useShortcuts() {
  const openEditor = useStore((s) => s.openEditor)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ignore while a dialog is open or while typing.
      if (document.querySelector('dialog[open]')) return
      const target = event.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      const ctrl = event.ctrlKey || event.metaKey
      if (ctrl && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openEditor({ mode: 'create' })
      } else if ((ctrl && event.key.toLowerCase() === 'f') || (!typing && event.key === '/')) {
        const search = document.getElementById('search-input') as HTMLInputElement | null
        if (search) {
          event.preventDefault()
          search.focus()
          search.select()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openEditor])
}

function Library() {
  const games = useVisibleGames()
  const total = useStore((s) => s.games.length)
  const mode = useStore((s) => s.view.mode)
  const openEditor = useStore((s) => s.openEditor)
  const showAllGames = useStore((s) => s.showAllGames)

  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Gamepad2 size={40} strokeWidth={1.5} />
        </div>
        <h2>Start your watchlist</h2>
        <p className="muted">Add the games you’re waiting for — release dates, trailers, tags and how much you want them.</p>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => openEditor({ mode: 'create' })}>
          Add your first game
        </Button>
        <p className="faint empty-hint">Tip: press Ctrl+N anytime to add a game.</p>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <SearchX size={40} strokeWidth={1.5} />
        </div>
        <h2>No games match</h2>
        <p className="muted">Try a different search or clear the filters.</p>
        <Button onClick={showAllGames}>Clear filters</Button>
      </div>
    )
  }

  return mode === 'table' ? <GameTable games={games} /> : <GameGrid games={games} />
}

export function App() {
  const status = useStore((s) => s.status)
  const loadError = useStore((s) => s.loadError)
  const init = useStore((s) => s.init)
  useShortcuts()

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') {
    return (
      <div className="boot">
        <div className="boot-spinner" aria-label="Loading" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="boot">
        <div className="boot-error" role="alert">
          <h2>Couldn’t open your game library</h2>
          <p className="muted">{loadError}</p>
          <Button icon={<RotateCw size={16} />} onClick={() => void init()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Toolbar />
        <div className="content">
          <Library />
        </div>
      </main>
      <GameDetail />
      <GameEditor />
      <TagManager />
      <Toasts />
    </div>
  )
}
