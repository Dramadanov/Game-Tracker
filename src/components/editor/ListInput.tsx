import { useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { cleanList, foldText } from '../../domain/game'
import { Chip } from '../ui'
import { SuggestionList, optionId, rankMatches, type SuggestionOption } from './Suggestions'

export interface ListInputProps {
  /** Id of the text input (the field label points at it). */
  id: string
  values: string[]
  onChange(values: string[]): void
  /** Offered while typing; anything else can be typed in too. */
  suggestions: readonly string[]
  placeholder?: string
  /** Singular noun for accessible names, e.g. "platform". */
  noun: string
}

const MAX_SUGGESTIONS = 60

/**
 * Chips + text box for free-form lists (platforms, genres, companies).
 * Enter or comma adds; pasting "a, b, c" adds three; Backspace on an empty box removes
 * the last chip; Up/Down pick from suggestions. Text left in the box is added on blur.
 */
export function ListInput({ id, values, onChange, suggestions, placeholder, noun }: ListInputProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = `${useId()}-list`

  const taken = useMemo(() => new Set(values.map(foldText)), [values])
  const query = text.trim()

  const options = useMemo(() => {
    const available = suggestions.filter((s) => !taken.has(foldText(s)))
    const matches = rankMatches(available, query, (s) => s).slice(0, MAX_SUGGESTIONS)
    const result: (SuggestionOption & { value: string })[] = matches.map((s) => ({ key: s, label: s, value: s }))
    const known = suggestions.some((s) => foldText(s) === foldText(query))
    if (query && !known && !taken.has(foldText(query))) {
      result.push({
        key: '__add__',
        value: query,
        action: true,
        icon: <Plus size={14} />,
        label: (
          <>
            Add “<strong>{query}</strong>”
          </>
        ),
      })
    }
    return result
  }, [suggestions, taken, query])

  const showList = open && options.length > 0

  /** Adds values, preferring the suggestion's spelling for known values. */
  const add = (raw: string[]) => {
    const canonical = raw.map((v) => {
      const key = foldText(v)
      return suggestions.find((s) => foldText(s) === key) ?? v
    })
    const next = cleanList([...values, ...canonical])
    if (next.length !== values.length) onChange(next)
  }

  const commitText = () => {
    if (text.trim()) add(text.split(','))
    setText('')
    setActive(-1)
  }

  const pick = (index: number) => {
    const option = options[index]
    if (!option) return
    add([option.value])
    setText('')
    setActive(-1)
    inputRef.current?.focus()
  }

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = options.length
    switch (event.key) {
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+Enter saves the dialog; make sure the typed value is part of it.
          commitText()
          return
        }
        event.preventDefault()
        if (showList && active >= 0) pick(active)
        else commitText()
        return
      case ',':
        event.preventDefault()
        commitText()
        return
      case 'Backspace':
        if (text === '' && values.length) {
          event.preventDefault()
          onChange(values.slice(0, -1))
        }
        return
      case 'ArrowDown':
        event.preventDefault()
        if (!showList) {
          setOpen(true)
          setActive(count ? 0 : -1)
        } else if (count) setActive((a) => (a + 1) % count)
        return
      case 'ArrowUp':
        event.preventDefault()
        if (!showList) {
          setOpen(true)
          setActive(count ? count - 1 : -1)
        } else if (count) setActive((a) => (a <= 0 ? count - 1 : a - 1))
        return
      case 'Escape':
        // Close the list, then clear the text; only then may Esc reach the dialog.
        if (showList || text) {
          event.preventDefault()
          event.stopPropagation()
          if (showList) setOpen(false)
          else setText('')
          setActive(-1)
        }
        return
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!/[,\n\r\t]/.test(pasted)) return
    event.preventDefault()
    add((text + pasted).split(/[,\n\r\t]+/))
    setText('')
    setActive(-1)
  }

  return (
    <div className="editor-combo">
      <div
        className="editor-chipbox"
        onMouseDown={(e) => {
          // Clicking the empty part of the box focuses the text input.
          if (e.target === e.currentTarget) {
            e.preventDefault()
            inputRef.current?.focus()
            setOpen(true)
          }
        }}
      >
        {values.map((value, i) => (
          <Chip key={foldText(value)} onRemove={() => removeAt(i)}>
            {value}
          </Chip>
        ))}
        <input
          ref={inputRef}
          id={id}
          className={`editor-chipbox-input${text === '' && values.length ? ' is-idle' : ''}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(listId, active) : undefined}
          aria-description={`Type and press Enter or comma to add a ${noun}.`}
          placeholder={values.length ? '' : placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onMouseDown={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => {
            // Keep typed text when the whole window loses focus (e.g. Alt+Tab).
            if (document.hasFocus()) commitText()
            setOpen(false)
            setActive(-1)
          }}
        />
      </div>
      {showList && (
        <SuggestionList
          id={listId}
          label={`${noun} suggestions`}
          options={options}
          active={active}
          onPick={pick}
          onHover={setActive}
        />
      )}
    </div>
  )
}
