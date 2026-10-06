import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ExternalLink, Plus, X } from 'lucide-react'
import { isWebUrl } from '../../domain/game'
import { openExternal } from '../../lib/external'
import { Button, IconButton } from '../ui'

/** One editable row: a short text (trailer title / link label) and a URL. */
export interface TextUrlRow {
  text: string
  url: string
}

export interface RowListInputProps {
  /** Prefix for input ids. */
  idPrefix: string
  rows: TextUrlRow[]
  onChange(rows: TextUrlRow[]): void
  /** Per-row validation messages (undefined = fine). */
  errors: (string | undefined)[]
  /** After a save attempt every row error is shown, not only touched ones. */
  showAllErrors: boolean
  /** e.g. "trailer" / "link". */
  noun: string
  textLabel: string
  textPlaceholder: string
  urlPlaceholder: string
  addLabel: string
  /** Optional preview at the start of each row (e.g. a YouTube thumbnail). */
  renderPreview?(row: TextUrlRow): ReactNode
}

let rowKeySeq = 0
const nextRowKey = () => `row-${++rowKeySeq}`

/** Rows of [text][URL][open][remove] with an "Add" button underneath. */
export function RowListInput({
  idPrefix,
  rows,
  onChange,
  errors,
  showAllErrors,
  noun,
  textLabel,
  textPlaceholder,
  urlPlaceholder,
  addLabel,
  renderPreview,
}: RowListInputProps) {
  // Stable keys so removing a row in the middle keeps focus and touched state on the right rows.
  const [keys, setKeys] = useState<string[]>(() => rows.map(nextRowKey))
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const focusKey = useRef<string | null>(null)
  const addId = `${idPrefix}-add`

  // Rows only change through this component; re-sync defensively if a parent ever replaces them.
  const rowKeys = keys.length === rows.length ? keys : rows.map((_, i) => keys[i] ?? nextRowKey())

  useEffect(() => {
    if (!focusKey.current) return
    document.getElementById(`${idPrefix}-${focusKey.current}-text`)?.focus()
    focusKey.current = null
  })

  const update = (index: number, patch: Partial<TextUrlRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const add = () => {
    const key = nextRowKey()
    focusKey.current = key
    setKeys([...rowKeys, key])
    onChange([...rows, { text: '', url: '' }])
  }

  const remove = (index: number) => {
    setKeys(rowKeys.filter((_, i) => i !== index))
    onChange(rows.filter((_, i) => i !== index))
    // Keep keyboard users in the list: next row's text box, else the add button.
    const next = rowKeys[index + 1] ?? rowKeys[index - 1]
    if (next) focusKey.current = next
    else document.getElementById(addId)?.focus()
  }

  return (
    <div className="editor-rows">
      {rows.length > 0 && (
        <ul className={`editor-rows-list${renderPreview ? ' has-preview' : ''}`}>
          {rows.map((row, i) => {
            const key = rowKeys[i]
            const error = errors[i]
            const showError = Boolean(error) && (showAllErrors || touched.has(key))
            const textId = `${idPrefix}-${key}-text`
            const urlId = `${idPrefix}-${key}-url`
            const errorId = `${idPrefix}-${key}-error`
            const n = i + 1
            return (
              <li key={key} className="editor-rows-item">
                <div className="editor-rows-row">
                  {renderPreview && <span className="editor-rows-preview">{renderPreview(row)}</span>}
                  <input
                    id={textId}
                    className="input editor-rows-text"
                    type="text"
                    autoComplete="off"
                    aria-label={`${textLabel} for ${noun} ${n}`}
                    placeholder={textPlaceholder}
                    value={row.text}
                    onChange={(e) => update(i, { text: e.target.value })}
                  />
                  <input
                    id={urlId}
                    className="input editor-rows-url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`URL for ${noun} ${n}`}
                    aria-invalid={showError ? true : undefined}
                    aria-describedby={showError ? errorId : undefined}
                    placeholder={urlPlaceholder}
                    value={row.url}
                    onChange={(e) => update(i, { url: e.target.value })}
                    onBlur={() => {
                      if (!touched.has(key) && row.url.trim()) setTouched(new Set(touched).add(key))
                    }}
                  />
                  <IconButton
                    size="sm"
                    label={`Open ${noun} ${n} in browser`}
                    icon={<ExternalLink size={14} />}
                    disabled={!isWebUrl(row.url)}
                    onClick={() => void openExternal(row.url.trim())}
                  />
                  <IconButton
                    size="sm"
                    label={`Remove ${noun} ${n}`}
                    icon={<X size={15} />}
                    className="editor-remove"
                    onClick={() => remove(i)}
                  />
                </div>
                {showError && (
                  <div className="field-error editor-rows-error" id={errorId}>
                    {error}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Button id={addId} variant="ghost" size="sm" icon={<Plus size={15} />} className="editor-rows-add" onClick={add}>
        {addLabel}
      </Button>
    </div>
  )
}
