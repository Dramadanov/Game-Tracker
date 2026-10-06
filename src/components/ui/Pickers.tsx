import { Check, ChevronDown } from 'lucide-react'
import { PERSONAL_STATUSES, PRIORITIES, personalStatusMeta } from '../../domain/constants'
import type { PersonalStatus, Priority } from '../../domain/types'
import { PriorityBadge } from './Badges'
import { MenuItem, Popover } from './Popover'

/**
 * Priority badge that opens a menu to change it. Used on cards, table rows and the detail view.
 * Clicks don't bubble, so it can sit inside clickable rows/cards.
 */
export function PriorityPicker({
  value,
  onChange,
  compact = false,
  align = 'start',
}: {
  value: Priority
  onChange(priority: Priority): void
  compact?: boolean
  align?: 'start' | 'end'
}) {
  return (
    <span className="picker" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover
        align={align}
        label="Set priority"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            className="picker-trigger"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            title="Change priority"
          >
            <PriorityBadge priority={value} compact={compact} />
          </button>
        )}
      >
        {(close) => (
          <div role="menu">
            <div className="menu-heading">Priority</div>
            {PRIORITIES.map((p) => (
              <MenuItem
                key={p.value}
                selected={p.value === value}
                icon={<span aria-hidden="true">{p.emoji}</span>}
                onSelect={() => {
                  close()
                  if (p.value !== value) onChange(p.value)
                }}
              >
                {p.label}
              </MenuItem>
            ))}
          </div>
        )}
      </Popover>
    </span>
  )
}

/** "My status" dropdown button. */
export function PersonalStatusPicker({
  value,
  onChange,
  align = 'start',
}: {
  value: PersonalStatus
  onChange(status: PersonalStatus): void
  align?: 'start' | 'end'
}) {
  const meta = personalStatusMeta(value)
  return (
    <span className="picker" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover
        align={align}
        label="Set my status"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            className={`picker-trigger picker-status${value === 'none' ? ' is-empty' : ''}`}
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            title="Change my status"
          >
            <span>{value === 'none' ? 'Set status' : meta.label}</span>
            <ChevronDown size={14} />
          </button>
        )}
      >
        {(close) => (
          <div role="menu">
            <div className="menu-heading">My status</div>
            {PERSONAL_STATUSES.map((s) => (
              <MenuItem
                key={s.value}
                selected={s.value === value}
                icon={s.value === value ? <Check size={14} /> : null}
                onSelect={() => {
                  close()
                  if (s.value !== value) onChange(s.value)
                }}
              >
                {s.label}
              </MenuItem>
            ))}
          </div>
        )}
      </Popover>
    </span>
  )
}
