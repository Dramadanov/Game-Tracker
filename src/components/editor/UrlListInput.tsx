import { useRef, useState, type ClipboardEvent } from 'react'
import { ExternalLink, Plus, X } from 'lucide-react'
import { isWebUrl } from '../../domain/game'
import { openExternal } from '../../lib/external'
import { Button, IconButton } from '../ui'
import { URL_HINT, splitUrls } from './formState'
import { Thumb } from './Thumb'

export interface UrlListInputProps {
  /** Id of the URL text box (the field label points at it). */
  id: string
  urls: string[]
  onChange(urls: string[]): void
  /** The text box content (kept by the editor so unsent URLs are saved too). */
  text: string
  onTextChange(text: string): void
  /** Error from the editor's validation (shown after a save attempt). */
  error?: string
  noun: string
}

/** URL box + "Add", then one row per URL with a thumbnail, the address and remove. */
export function UrlListInput({ id, urls, onChange, text, onTextChange, error, noun }: UrlListInputProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = `${id}-error`
  const shownError = localError ?? error

  /** Adds every valid URL in `value`; invalid ones stay in the box with an error. */
  const addFrom = (value: string) => {
    const parts = splitUrls(value)
    if (!parts.length) return
    const known = new Set(urls)
    const fresh: string[] = []
    const invalid: string[] = []
    let duplicates = 0
    for (const part of parts) {
      if (!isWebUrl(part)) invalid.push(part)
      else if (known.has(part)) duplicates++
      else {
        known.add(part)
        fresh.push(part)
      }
    }
    if (fresh.length) onChange([...urls, ...fresh])
    onTextChange(invalid.join(' '))
    if (invalid.length) setLocalError(`“${invalid[0]}” is not a web address. ${URL_HINT}`)
    else if (duplicates && !fresh.length) setLocalError(`That ${noun} is already in the list.`)
    else setLocalError(null)
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    // Pasting into an empty box adds straight away when everything pasted is a URL.
    const pasted = event.clipboardData.getData('text')
    const parts = splitUrls(pasted)
    if (text.trim() || !parts.length || !parts.every(isWebUrl)) return
    event.preventDefault()
    addFrom(pasted)
  }

  return (
    <div className="editor-urllist">
      <div className="editor-urllist-add">
        <input
          ref={inputRef}
          id={id}
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste an image URL and press Enter"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
          value={text}
          onChange={(e) => {
            onTextChange(e.target.value)
            setLocalError(null)
          }}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
              e.preventDefault()
              addFrom(text)
            }
          }}
        />
        <Button icon={<Plus size={16} />} onClick={() => addFrom(text)} disabled={!text.trim()}>
          Add
        </Button>
      </div>
      {shownError && (
        <div className="field-error editor-urllist-error" id={errorId}>
          {shownError}
        </div>
      )}
      {urls.length > 0 && (
        <ul className="editor-urllist-rows">
          {urls.map((url, i) => (
            <li key={url} className="editor-urllist-row">
              <Thumb url={url} />
              <span className="editor-urllist-url" title={url}>
                {url}
              </span>
              <IconButton
                size="sm"
                label={`Open ${noun} ${i + 1} in browser`}
                icon={<ExternalLink size={14} />}
                onClick={() => void openExternal(url)}
              />
              <IconButton
                size="sm"
                label={`Remove ${noun} ${i + 1}`}
                icon={<X size={15} />}
                className="editor-remove"
                onClick={() => {
                  onChange(urls.filter((_, j) => j !== i))
                  inputRef.current?.focus()
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
