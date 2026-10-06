import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Bookmark, MoreHorizontal, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import type { SavedView } from '../../domain/types'
import { useStore } from '../../state/store'
import { Popover } from '../ui'
import { Count } from './Count'
import { opensUpward, useFocusReturn } from './popoverAssist'

/** Approximate height of the actions menu, used to decide whether it opens upwards. */
const MENU_HEIGHT = 130

export interface SavedViewItemProps {
  view: SavedView
  count: number
  active: boolean
  /** The current view differs from this saved view's configuration. */
  differs: boolean
  onRequestDelete(view: SavedView): void
}

/** One saved view in the sidebar: click to apply, "…" menu to rename, overwrite or delete. */
export function SavedViewItem({ view, count, active, differs, onRequestDelete }: SavedViewItemProps) {
  const applySavedView = useStore((s) => s.applySavedView)
  const renameSavedView = useStore((s) => s.renameSavedView)
  const updateSavedView = useStore((s) => s.updateSavedView)
  const [renaming, setRenaming] = useState(false)
  const mainRef = useRef<HTMLButtonElement>(null)
  const refocusMain = useRef(false)
  const edited = active && differs

  useEffect(() => {
    if (!renaming && refocusMain.current) {
      refocusMain.current = false
      mainRef.current?.focus()
    }
  }, [renaming])

  if (renaming) {
    return (
      <li className="sidebar-item is-editing">
        <span className="sidebar-item-icon" aria-hidden="true">
          <Bookmark size={16} />
        </span>
        <RenameInput
          initial={view.name}
          onDone={(name, viaKeyboard) => {
            refocusMain.current = viaKeyboard
            setRenaming(false)
            const clean = name?.replace(/\s+/g, ' ').trim()
            if (clean && clean !== view.name) void renameSavedView(view.id, clean)
          }}
        />
      </li>
    )
  }

  return (
    <li className={`sidebar-item has-actions${active ? ' is-active' : ''}`}>
      <button
        ref={mainRef}
        type="button"
        className="sidebar-item-main"
        aria-current={active ? 'true' : undefined}
        onClick={() => applySavedView(view.id)}
        title={view.name}
      >
        <span className="sidebar-item-icon" aria-hidden="true">
          <Bookmark size={16} />
        </span>
        <span className="sidebar-item-label">{view.name}</span>
        {edited && (
          <span className="sidebar-edited" title="Edited — the current view differs from this saved view">
            <span className="visually-hidden">(edited)</span>
          </span>
        )}
        <Count value={count} />
      </button>
      <ViewActions
        view={view}
        differs={differs}
        onRename={() => setRenaming(true)}
        onUpdate={() => void updateSavedView(view.id)}
        onDelete={() => onRequestDelete(view)}
      />
    </li>
  )
}

function ViewActions({
  view,
  differs,
  onRename,
  onUpdate,
  onDelete,
}: {
  view: SavedView
  differs: boolean
  onRename(): void
  onUpdate(): void
  onDelete(): void
}) {
  const [upward, setUpward] = useState(false)
  return (
    <span className="sidebar-item-actions">
      <Popover
        align="end"
        label={`Actions for ${view.name}`}
        panelClassName={`sidebar-menu${upward ? ' sidebar-menu-up' : ''}`}
        trigger={({ open, toggle }) => (
          <ActionsTrigger
            open={open}
            label={`More actions for ${view.name}`}
            onClick={(el) => {
              if (!open) setUpward(opensUpward(el, MENU_HEIGHT))
              toggle()
            }}
          />
        )}
      >
        {(close) => (
          <MenuList label={view.name}>
            <ActionItem
              icon={<Pencil size={14} />}
              onSelect={() => {
                close()
                onRename()
              }}
            >
              Rename
            </ActionItem>
            <ActionItem
              icon={<RefreshCw size={14} />}
              disabled={!differs}
              onSelect={() => {
                close()
                onUpdate()
              }}
            >
              Update with current view
            </ActionItem>
            <div className="menu-separator" role="separator" />
            <ActionItem
              danger
              icon={<Trash2 size={14} />}
              onSelect={() => {
                close()
                onDelete()
              }}
            >
              Delete
            </ActionItem>
          </MenuList>
        )}
      </Popover>
    </span>
  )
}

function ActionsTrigger({ open, label, onClick }: { open: boolean; label: string; onClick(el: HTMLElement): void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useFocusReturn(open, ref)
  return (
    <button
      ref={ref}
      type="button"
      className="sidebar-item-action"
      aria-label={label}
      title="More actions"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => onClick(e.currentTarget)}
    >
      <MoreHorizontal size={16} />
    </button>
  )
}

/** Menu container: focuses the first item on open and supports arrow-key navigation. */
function MenuList({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])

  useEffect(() => {
    items()[0]?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    if (!list.length) return
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = (index + 1) % list.length
    else if (event.key === 'ArrowUp') next = (index - 1 + list.length) % list.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = list.length - 1
    if (next === null) return
    event.preventDefault()
    list[next].focus()
  }

  return (
    <div ref={ref} role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {children}
    </div>
  )
}

function ActionItem({
  icon,
  children,
  onSelect,
  danger = false,
  disabled = false,
}: {
  icon: ReactNode
  children: ReactNode
  onSelect(): void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item${danger ? ' is-danger' : ''}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="menu-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="menu-item-label">{children}</span>
    </button>
  )
}

/** In-place name editor. Enter or blur commits, Esc cancels (reported as `null`). */
function RenameInput({
  initial,
  onDone,
}: {
  initial: string
  onDone(name: string | null, viaKeyboard: boolean): void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  const finished = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const finish = (name: string | null, viaKeyboard: boolean) => {
    if (finished.current) return
    finished.current = true
    onDone(name, viaKeyboard)
  }

  return (
    <input
      ref={ref}
      className="sidebar-rename"
      value={value}
      maxLength={80}
      spellCheck={false}
      aria-label="Saved view name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value, false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(value, true)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          finish(null, true)
        }
      }}
    />
  )
}
