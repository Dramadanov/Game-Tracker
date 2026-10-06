import type { CSSProperties } from 'react'
import { X } from 'lucide-react'
import { Button, TagChip } from '../ui'
import { isDefaultFilters } from '../../domain/filtering'
import { useTagsById } from '../../state/selectors'
import { useStore } from '../../state/store'
import { activeFilterItems, type ActiveFilterItem } from './filterSummary'

/** One removable chip per active filter value, under the toolbar. Hidden when nothing is filtered. */
export function ActiveFilterChips() {
  const filters = useStore((s) => s.view.filters)
  const setFilters = useStore((s) => s.setFilters)
  const resetFilters = useStore((s) => s.resetFilters)
  const tagsById = useTagsById()

  if (isDefaultFilters(filters)) return null

  const items = activeFilterItems(filters, tagsById)
  const matchAll = filters.tagMatch === 'all' && items.filter((i) => i.tag).length >= 2
  const lastTagIndex = items.findLastIndex((i) => i.tag)

  return (
    <div className="toolbar-chips" role="region" aria-label="Active filters">
      <ul className="toolbar-chip-list">
        {items.map((item, index) => (
          <li key={item.key} className="toolbar-chip-item">
            {item.tag ? (
              <TagChip tag={item.tag} onRemove={() => setFilters(item.remove)} />
            ) : (
              <FilterChip item={item} onRemove={() => setFilters(item.remove)} />
            )}
            {matchAll && index === lastTagIndex && <span className="toolbar-chips-note">matching all tags</span>}
          </li>
        ))}
        <li className="toolbar-chip-item">
          <Button variant="ghost" size="sm" className="toolbar-chips-clear" onClick={resetFilters}>
            Clear all
          </Button>
        </li>
      </ul>
    </div>
  )
}

function FilterChip({ item, onRemove }: { item: ActiveFilterItem; onRemove(): void }) {
  const name = item.prefix ? `${item.prefix}: ${item.label}` : item.label
  const style = {
    ...(item.tint ? { '--toolbar-chip-tint': item.tint } : {}),
    ...(item.dotColor ? { '--toolbar-chip-dot': item.dotColor } : {}),
  } as CSSProperties
  return (
    <span className={`toolbar-chip${item.tint ? ' is-tinted' : ''}`} style={style} title={name}>
      {item.emoji && (
        <span className="toolbar-chip-emoji" aria-hidden="true">
          {item.emoji}
        </span>
      )}
      {item.dotColor && <span className="toolbar-chip-dot" aria-hidden="true" />}
      {item.prefix && <span className="toolbar-chip-prefix">{item.prefix}:</span>}
      <span className="toolbar-chip-label">{item.label}</span>
      <button type="button" className="toolbar-chip-remove" onClick={onRemove} aria-label={`Remove filter ${name}`}>
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  )
}
