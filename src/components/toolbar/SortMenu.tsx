import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowUpDown, Check } from 'lucide-react'
import { Button, MenuItem, Popover } from '../ui'
import { SORT_FIELDS } from '../../domain/constants'
import type { SortDirection, SortSpec } from '../../domain/types'
import { useStore } from '../../state/store'
import { describeSort, sortDirectionLabels, sortFieldLabel } from './filterSummary'

/** Sort button showing the current field; opens a menu of fields and directions. */
export function SortMenu() {
  const sort = useStore((s) => s.view.sort)
  const setSort = useStore((s) => s.setSort)
  const rootRef = useRef<HTMLDivElement>(null)
  const focusTrigger = () => rootRef.current?.querySelector<HTMLButtonElement>('[data-testid="toolbar-sort"]')?.focus()
  const description = describeSort(sort)

  return (
    <div className="toolbar-popover" ref={rootRef}>
      <Popover
        align="end"
        label="Sort"
        panelClassName="toolbar-sort-panel"
        trigger={({ open, toggle }) => (
          <Button
            variant="ghost"
            className={`toolbar-btn toolbar-btn-collapsible${open ? ' is-open' : ''}`}
            icon={<ArrowUpDown size={16} aria-hidden="true" />}
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Sort by ${description}`}
            title={`Sort by ${description}`}
            data-testid="toolbar-sort"
          >
            <span className="toolbar-btn-label">{sortFieldLabel(sort.field)}</span>
          </Button>
        )}
      >
        {(close) => (
          <SortMenuContent
            sort={sort}
            onPick={(next) => {
              close()
              focusTrigger()
              if (next.field !== sort.field || next.direction !== sort.direction) setSort(next)
            }}
          />
        )}
      </Popover>
    </div>
  )
}

function SortMenuContent({ sort, onPick }: { sort: SortSpec; onPick(sort: SortSpec): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const labels = sortDirectionLabels(sort.field)

  // Move focus into the menu (onto the current field) so arrow keys work right away.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.menu-item.is-selected')?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.menu-item:not(:disabled)') ?? [])]
    if (!items.length) return
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next < 0) return
    event.preventDefault()
    items[next].focus()
  }

  const directions: SortDirection[] = ['asc', 'desc']

  return (
    <div className="toolbar-sort" ref={ref} onKeyDown={onKeyDown}>
      <div role="menu" aria-label="Sort by">
        <div className="menu-heading">Sort by</div>
        {SORT_FIELDS.map((f) => {
          const selected = f.value === sort.field
          return (
            <MenuItem
              key={f.value}
              selected={selected}
              icon={selected ? <Check size={14} /> : <span />}
              onSelect={() => onPick(selected ? sort : { field: f.value, direction: 'asc' })}
            >
              {f.label}
            </MenuItem>
          )
        })}
      </div>
      <div className="menu-separator" role="separator" />
      <div role="menu" aria-label="Order">
        <div className="menu-heading">Order</div>
        {directions.map((direction) => {
          const selected = direction === sort.direction
          return (
            <MenuItem
              key={direction}
              selected={selected}
              icon={selected ? <Check size={14} /> : <span />}
              onSelect={() => onPick({ field: sort.field, direction })}
            >
              {labels[direction]}
            </MenuItem>
          )
        })}
      </div>
    </div>
  )
}
