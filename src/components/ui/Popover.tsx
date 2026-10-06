import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface PopoverProps {
  /** Renders the trigger. Call `toggle` on click; `open` lets the trigger show state. */
  trigger(props: { open: boolean; toggle(): void; close(): void }): ReactNode
  /** Panel content. Receives `close` so menu items can dismiss the popover. */
  children(close: () => void): ReactNode
  align?: 'start' | 'end'
  /** Extra class on the floating panel. */
  panelClassName?: string
  /** Accessible label for the panel. */
  label?: string
}

/**
 * Small anchored panel for menus and pickers. Closes on outside click and Esc.
 * The panel is positioned below the trigger, aligned to its start or end edge.
 */
export function Popover({ trigger, children, align = 'start', panelClassName = '', label }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close only the popover, not a dialog that contains it.
        event.stopPropagation()
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    // Capture phase on the document: Esc closes the popover even if focus is elsewhere
    // (e.g. on <body> after a button inside the panel disabled itself), and runs before
    // a containing <dialog> would treat the same Esc as a close request.
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className="popover-root" ref={rootRef}>
      {trigger({ open, toggle: () => setOpen((o) => !o), close })}
      {open && (
        <div className={`popover-panel popover-${align} ${panelClassName}`} role="dialog" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  )
}

export interface MenuItemProps {
  onSelect(): void
  children: ReactNode
  icon?: ReactNode
  selected?: boolean
  danger?: boolean
  disabled?: boolean
}

/** A row inside a Popover acting as a menu. */
export function MenuItem({ onSelect, children, icon, selected, danger, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`menu-item${selected ? ' is-selected' : ''}${danger ? ' is-danger' : ''}`}
      onClick={onSelect}
      disabled={disabled}
      role={selected === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={selected}
    >
      {icon && <span className="menu-item-icon">{icon}</span>}
      <span className="menu-item-label">{children}</span>
    </button>
  )
}
