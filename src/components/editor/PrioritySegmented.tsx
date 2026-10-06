import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { PRIORITIES } from '../../domain/constants'
import type { Priority } from '../../domain/types'

/**
 * Five-way priority switch. A real radio group: one tab stop, arrow keys move the choice.
 */
export function PrioritySegmented({
  value,
  onChange,
  labelledBy,
}: {
  value: Priority
  onChange(priority: Priority): void
  labelledBy: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(
    0,
    PRIORITIES.findIndex((p) => p.value === value),
  )

  const move = (next: number) => {
    const i = (next + PRIORITIES.length) % PRIORITIES.length
    onChange(PRIORITIES[i].value)
    refs.current[i]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    if (event.key in step) {
      event.preventDefault()
      move(index + step[event.key])
    } else if (event.key === 'Home') {
      event.preventDefault()
      move(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      move(PRIORITIES.length - 1)
    }
  }

  return (
    <div className="editor-priority" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {PRIORITIES.map((p, i) => {
        const selected = p.value === value
        return (
          <button
            key={p.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`editor-priority-option${selected ? ' is-selected' : ''}`}
            style={{ '--editor-priority-color': `var(${p.colorVar})` } as CSSProperties}
            onClick={() => onChange(p.value)}
          >
            <span className="editor-priority-emoji" aria-hidden="true">
              {p.emoji}
            </span>
            <span className="editor-priority-label">{p.label}</span>
          </button>
        )
      })}
    </div>
  )
}
