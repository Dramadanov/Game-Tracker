import { useRef, type FocusEvent, type KeyboardEvent } from 'react'
import { DATE_PRECISIONS, MAX_YEAR, MIN_YEAR, MONTH_NAMES, type DatePrecision } from '../../domain/releaseDate'
import { Select, TextInput } from '../ui'
import { parseYear, switchPrecision, type DateDraft, type DatePart } from './dateDraft'

export interface ReleaseDateInputProps {
  /** Id of the precision select (the field label points at it). Parts get `${id}-${part}`. */
  id: string
  value: DateDraft
  onChange(value: DateDraft): void
  /** The part currently in error, if the error is being shown. */
  invalidPart?: DatePart | null
  /** Id of the hint/error line. */
  describedBy?: string
  /** Called when focus leaves the whole control. */
  onBlur?(): void
}

/**
 * Release date with its precision: exact day, month, quarter, year or TBA.
 * Switching precision keeps the year (and month/quarter where they can be derived).
 */
export function ReleaseDateInput({ id, value, onChange, invalidPart, describedBy, onBlur }: ReleaseDateInputProps) {
  const set = (patch: Partial<DateDraft>) => onChange({ ...value, ...patch })
  /** Whether the precision select is being driven by the keyboard (arrows change it step by step). */
  const keyboardRef = useRef(false)
  const partProps = (part: DatePart) => ({
    id: `${id}-${part}`,
    'aria-invalid': invalidPart === part ? true : undefined,
    'aria-describedby': describedBy,
  })

  const changePrecision = (next: DatePrecision) => {
    const updated = switchPrecision(value, next)
    onChange(updated)
    // After a pointer pick, move on to the first part to fill in. Not while arrowing through
    // the options with the keyboard: each step fires a change and must keep focus here.
    if (next === 'tba' || keyboardRef.current) return
    // Put the cursor where the next decision is: the first empty part, else the main one.
    const first: DatePart =
      next === 'day'
        ? 'day'
        : next === 'month' && !updated.month
          ? 'month'
          : next === 'quarter' && !updated.quarter
            ? 'quarter'
            : 'year'
    requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus())
  }

  const onYearKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const current = parseYear(value.year) ?? new Date().getFullYear() - (event.key === 'ArrowUp' ? 1 : -1)
    const next = Math.min(MAX_YEAR, Math.max(MIN_YEAR, current + (event.key === 'ArrowUp' ? 1 : -1)))
    set({ year: String(next) })
  }

  const yearInput = (
    <TextInput
      {...partProps('year')}
      className="editor-date-year"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      placeholder={String(new Date().getFullYear() + 1)}
      aria-label="Release year"
      value={value.year}
      onChange={(e) => set({ year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
      onKeyDown={onYearKey}
    />
  )

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.()
  }

  return (
    <div className="editor-date" onBlur={handleBlur}>
      <Select
        id={id}
        className="editor-date-precision"
        value={value.precision}
        onChange={(e) => changePrecision(e.target.value as DatePrecision)}
        onKeyDown={() => {
          keyboardRef.current = true
        }}
        onPointerDown={() => {
          keyboardRef.current = false
        }}
        aria-describedby={describedBy}
      >
        {DATE_PRECISIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>

      {value.precision === 'day' && (
        <TextInput
          {...partProps('day')}
          type="date"
          className="editor-date-day"
          min={`${MIN_YEAR}-01-01`}
          max={`${MAX_YEAR}-12-31`}
          aria-label="Release day"
          value={value.date}
          onChange={(e) => set({ date: e.target.value })}
        />
      )}

      {value.precision === 'month' && (
        <>
          <Select
            {...partProps('month')}
            className="editor-date-month"
            aria-label="Release month"
            value={value.month}
            onChange={(e) => set({ month: e.target.value })}
          >
            <option value="" disabled>
              Month…
            </option>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </Select>
          {yearInput}
        </>
      )}

      {value.precision === 'quarter' && (
        <>
          <Select
            {...partProps('quarter')}
            className="editor-date-quarter"
            aria-label="Release quarter"
            value={value.quarter}
            onChange={(e) => set({ quarter: e.target.value })}
          >
            <option value="" disabled>
              Q…
            </option>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={String(q)}>
                Q{q}
              </option>
            ))}
          </Select>
          {yearInput}
        </>
      )}

      {value.precision === 'year' && yearInput}

      {value.precision === 'tba' && <div className="editor-date-tba">To be announced</div>}
    </div>
  )
}
