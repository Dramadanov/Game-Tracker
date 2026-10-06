import { useEffect, useRef, useState, type RefObject } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Game, SortField } from '../../domain/types'
import { useTagsById, useToday } from '../../state/selectors'
import { useStore } from '../../state/store'
import { GameRow } from './GameRow'
import './table.css'

interface Column {
  field: SortField
  label: string
  /** Base width in px; columns grow proportionally when the window is wider than their sum. */
  width: number
}

const COLUMNS: readonly Column[] = [
  { field: 'title', label: 'Title', width: 216 },
  { field: 'priority', label: 'Priority', width: 112 },
  { field: 'releaseDate', label: 'Release', width: 100 },
  { field: 'releaseStatus', label: 'Status', width: 108 },
  { field: 'personalStatus', label: 'My status', width: 124 },
  { field: 'platforms', label: 'Platforms', width: 88 },
  { field: 'genres', label: 'Genres', width: 80 },
  { field: 'developers', label: 'Developer', width: 88 },
  { field: 'publishers', label: 'Publisher', width: 88 },
  { field: 'tags', label: 'Tags', width: 120 },
  { field: 'createdAt', label: 'Added', width: 100 },
]

const TAGS_WIDTH = COLUMNS.find((c) => c.field === 'tags')?.width ?? 120
const MIN_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0)

/** Nearest ancestor that scrolls horizontally (the app's .content pane). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowX } = getComputedStyle(node)
    if (overflowX === 'auto' || overflowX === 'scroll') return node
  }
  return null
}

/** Whether the surrounding pane is scrolled sideways (draws a shadow on the sticky title column). */
function useScrolledX(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref.current
    const scroller = el ? scrollParent(el) : null
    if (!scroller) return
    const update = () => setScrolled(scroller.scrollLeft > 0)
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [ref])
  return scrolled
}

/** Content width of an element (rounded down to 4px steps to avoid re-rendering every row on each pixel). */
function useContentWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width / 4) * 4)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/** Sortable table of the (already filtered and sorted) games. Scrolls with the surrounding .content pane. */
export function GameTable({ games }: { games: Game[] }) {
  const tagsById = useTagsById()
  const today = useToday()
  const sort = useStore((s) => s.view.sort)
  const toggleSort = useStore((s) => s.toggleSort)
  const selectedId = useStore((s) => s.selectedGameId)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrolledX = useScrolledX(rootRef)
  const tagsHeaderRef = useRef<HTMLTableCellElement>(null)
  const tagBudget = useContentWidth(tagsHeaderRef, TAGS_WIDTH - 16)

  return (
    <div ref={rootRef} className={`table-root${scrolledX ? ' is-scrolled-x' : ''}`}>
      <table className="table-table" style={{ minWidth: MIN_WIDTH }}>
        <caption className="visually-hidden">Games — click a column header to sort</caption>
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c.field} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.field === c.field
              const Arrow = active && sort.direction === 'desc' ? ArrowDown : ArrowUp
              return (
                <th
                  key={c.field}
                  ref={c.field === 'tags' ? tagsHeaderRef : undefined}
                  scope="col"
                  className={`table-th${c.field === 'title' ? ' table-sticky' : ''}${active ? ' is-active' : ''}`}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <button type="button" className="table-sort" onClick={() => toggleSort(c.field)}>
                    <span className="table-sort-label">{c.label}</span>
                    <Arrow size={13} strokeWidth={2.25} className="table-sort-icon" aria-hidden="true" />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              tagsById={tagsById}
              today={today}
              selected={game.id === selectedId}
              tagBudget={tagBudget}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
