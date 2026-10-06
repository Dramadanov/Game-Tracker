import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import { personalStatusMeta, priorityMeta, releaseStatusMeta } from '../../domain/constants'
import type { PersonalStatus, Priority, ReleaseStatus, Tag } from '../../domain/types'

/** "🔥 Must Play" pill in the priority's color. `compact` shows the emoji only (label kept for a11y). */
export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  const meta = priorityMeta(priority)
  return (
    <span
      className={`priority-badge${compact ? ' is-compact' : ''}`}
      style={{ '--badge-color': `var(${meta.colorVar})` } as CSSProperties}
      title={meta.label}
    >
      <span className="priority-emoji" aria-hidden="true">
        {meta.emoji}
      </span>
      {compact ? <span className="visually-hidden">{meta.label}</span> : <span>{meta.label}</span>}
    </span>
  )
}

/** Official release status, colored by lifecycle stage. */
export function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  const meta = releaseStatusMeta(status)
  return (
    <span className="status-badge" style={{ '--badge-color': `var(--status-${status})` } as CSSProperties}>
      <span className="status-dot" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

/** My personal status. Renders nothing for 'none' unless `showNone`. */
export function PersonalStatusBadge({ status, showNone = false }: { status: PersonalStatus; showNone?: boolean }) {
  if (status === 'none' && !showNone) return null
  return <span className="personal-badge">{personalStatusMeta(status).label}</span>
}

export interface TagChipProps {
  tag: Tag
  onRemove?(): void
  onClick?(): void
  size?: 'sm' | 'md'
  selected?: boolean
}

/** Colored tag chip. Clickable and/or removable. */
export function TagChip({ tag, onRemove, onClick, size = 'md', selected }: TagChipProps) {
  const style = { '--tag-color': tag.color } as CSSProperties
  const content = (
    <>
      <span className="tag-dot" aria-hidden="true" />
      <span className="tag-name">{tag.name}</span>
    </>
  )
  return (
    <span className={`tag-chip tag-chip-${size}${selected ? ' is-selected' : ''}`} style={style}>
      {onClick ? (
        <button type="button" className="tag-chip-main" onClick={onClick} aria-pressed={selected}>
          {content}
        </button>
      ) : (
        <span className="tag-chip-main">{content}</span>
      )}
      {onRemove && (
        <button type="button" className="tag-chip-remove" onClick={onRemove} aria-label={`Remove tag ${tag.name}`}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}

/** Neutral chip for plain values (platforms, genres, companies). */
export function Chip({ children, onRemove, title }: { children: ReactNode; onRemove?(): void; title?: string }) {
  return (
    <span className="chip" title={title}>
      <span className="chip-label">{children}</span>
      {onRemove && (
        <button type="button" className="chip-remove" onClick={onRemove} aria-label={`Remove ${String(children)}`}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}
