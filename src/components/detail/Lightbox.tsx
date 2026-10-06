import { useEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from 'lucide-react'
import { displayUrl } from './format'
import './lightbox.css'

export interface LightboxProps {
  images: readonly string[]
  index: number
  /** Used in the accessible name, e.g. the game title. */
  title: string
  onIndexChange(index: number): void
  onClose(): void
  onOpenExternal(url: string): void
}

/**
 * Full-window image viewer on its own modal <dialog>, so it stacks above the game dialog in
 * the top layer. Esc and clicks on the dark area close only the lightbox.
 */
export function Lightbox({ images, index, title, onIndexChange, onClose, onOpenExternal }: LightboxProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const count = images.length
  const current = Math.min(Math.max(index, 0), count - 1)
  const url = images[current] ?? ''
  const broken = failed.has(url)

  // Open on mount, close on unmount and give focus back to the thumbnail that opened it.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    dialog.focus()
    return () => {
      if (dialog.open) dialog.close()
      previouslyFocused?.focus?.()
    }
  }, [])

  // Esc: close the lightbox ourselves (and only it — `cancel` doesn't reach the game dialog).
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [onClose])

  const go = (delta: number) => {
    if (count > 1) onIndexChange((current + delta + count) % count)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    let handled = true
    if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'ArrowRight') go(1)
    else if (event.key === 'Home') onIndexChange(0)
    else if (event.key === 'End') onIndexChange(count - 1)
    else handled = false
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  // Clicks on the dark area (anything marked as backdrop) close; the image and buttons don't.
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    const target = event.target as HTMLElement
    if (target === event.currentTarget || target.dataset.backdrop !== undefined) onClose()
  }

  return (
    <dialog
      ref={ref}
      className="detail-lightbox"
      aria-label={`${title} — screenshot ${current + 1} of ${count}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className="detail-lb-top" data-backdrop="">
        <span className="detail-lb-counter" aria-live="polite">
          {current + 1} / {count}
        </span>
        <span className="detail-lb-tools">
          <button
            type="button"
            className="detail-lb-btn"
            onClick={() => onOpenExternal(url)}
            aria-label="Open image in your browser"
            title="Open image in your browser"
          >
            <ExternalLink size={17} />
          </button>
          <button type="button" className="detail-lb-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <X size={20} />
          </button>
        </span>
      </div>

      <div className="detail-lb-stage" data-backdrop="">
        {count > 1 && (
          <button
            type="button"
            className="detail-lb-nav is-prev"
            onClick={() => go(-1)}
            aria-label="Previous screenshot"
            title="Previous (←)"
          >
            <ChevronLeft size={26} />
          </button>
        )}

        {broken ? (
          <div className="detail-lb-broken" key={`broken-${url}`}>
            <ImageOff size={36} strokeWidth={1.4} aria-hidden="true" />
            <p className="detail-lb-broken-title">This screenshot couldn’t be loaded</p>
            <p className="detail-lb-broken-url" title={url}>
              {displayUrl(url)}
            </p>
            <button type="button" className="detail-lb-pill" onClick={() => onOpenExternal(url)}>
              <ExternalLink size={14} aria-hidden="true" />
              Open in browser
            </button>
          </div>
        ) : (
          <img
            key={url}
            className="detail-lb-img"
            src={url}
            alt={`Screenshot ${current + 1} of ${count}`}
            referrerPolicy="no-referrer"
            decoding="async"
            draggable={false}
            onError={() => setFailed((prev) => new Set(prev).add(url))}
          />
        )}

        {count > 1 && (
          <button
            type="button"
            className="detail-lb-nav is-next"
            onClick={() => go(1)}
            aria-label="Next screenshot"
            title="Next (→)"
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>
    </dialog>
  )
}
