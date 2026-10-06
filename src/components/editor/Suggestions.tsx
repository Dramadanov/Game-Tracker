import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { foldText } from '../../domain/game'

export interface SuggestionOption {
  key: string
  label: ReactNode
  icon?: ReactNode
  /** Visually set apart (e.g. "Create tag …" / "Add …" actions). */
  action?: boolean
}

/**
 * Items whose folded text contains the query, best first: exact, then prefix,
 * then word-start, then anywhere. Stable within each group.
 */
export function rankMatches<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  const q = foldText(query)
  if (!q) return [...items]
  const scored: { item: T; score: number; i: number }[] = []
  items.forEach((item, i) => {
    const t = foldText(text(item))
    const at = t.indexOf(q)
    if (at < 0) return
    const score = t === q ? 0 : at === 0 ? 1 : /[\s\-/|&(]/.test(t[at - 1]) ? 2 : 3
    scored.push({ item, score, i })
  })
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.item)
}

export function optionId(listId: string, index: number): string {
  return `${listId}-opt-${index}`
}

/** The floating listbox under a combobox input. Mouse-down never steals focus from the input. */
export function SuggestionList({
  id,
  options,
  active,
  onPick,
  onHover,
  label,
}: {
  id: string
  options: SuggestionOption[]
  active: number
  onPick(index: number): void
  onHover(index: number): void
  label: string
}) {
  const ref = useRef<HTMLUListElement>(null)
  const [placement, setPlacement] = useState<'down' | 'up'>('down')

  // Before the first paint: make room below by scrolling the dialog body if there is more
  // content below; only at the very bottom open upward instead.
  useLayoutEffect(() => {
    const list = ref.current
    const anchor = list?.parentElement
    const scroller = list?.closest<HTMLElement>('.modal-body')
    const content = scroller?.firstElementChild
    if (!list || !anchor || !scroller || !content) return
    const view = scroller.getBoundingClientRect()
    const box = anchor.getBoundingClientRect()
    const needed = list.offsetHeight + 8
    const below = view.bottom - box.bottom
    if (below >= needed) return
    const hidden = content.getBoundingClientRect().bottom + parseFloat(getComputedStyle(scroller).paddingBottom) - view.bottom
    if (hidden >= needed - below) {
      scroller.scrollTop += needed - below
      return
    }
    const above = box.top - view.top
    if (above > below + hidden) setPlacement('up')
    else scroller.scrollTop += Math.max(0, hidden)
  }, [])

  useEffect(() => {
    if (active < 0) return
    document.getElementById(optionId(id, active))?.scrollIntoView({ block: 'nearest' })
  }, [active, id])

  return (
    <ul
      ref={ref}
      id={id}
      role="listbox"
      aria-label={label}
      className={`editor-suggest editor-suggest-${placement}`}
      onMouseDown={(e) => e.preventDefault()}
    >
      {options.map((option, i) => (
        <li
          key={option.key}
          id={optionId(id, i)}
          role="option"
          aria-selected={i === active}
          className={`editor-suggest-option${i === active ? ' is-active' : ''}${option.action ? ' is-action' : ''}`}
          onMouseMove={() => {
            if (i !== active) onHover(i)
          }}
          onClick={() => onPick(i)}
        >
          {option.icon && <span className="editor-suggest-icon">{option.icon}</span>}
          <span className="editor-suggest-label">{option.label}</span>
        </li>
      ))}
    </ul>
  )
}
