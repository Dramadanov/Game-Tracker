import { useEffect, useRef } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../../state/store'

const ICONS = {
  success: <CheckCircle2 size={16} />,
  error: <TriangleAlert size={16} />,
  info: <Info size={16} />,
}

/**
 * Bottom-right stack of transient messages. Errors stay longer and are announced assertively.
 *
 * Modal dialogs live in the browser's top layer, above any z-index, so the stack is a
 * manual popover: it is (re-)shown in the top layer whenever a toast arrives, which puts
 * it above any dialog that is open at that moment.
 */
export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  const ref = useRef<HTMLDivElement>(null)
  const count = toasts.length
  const newestId = toasts.at(-1)?.id

  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.showPopover !== 'function') return
    const isOpen = el.matches(':popover-open')
    if (count === 0) {
      if (isOpen) el.hidePopover()
      return
    }
    // Re-insert into the top layer so the newest toast sits above any open dialog.
    if (isOpen) el.hidePopover()
    el.showPopover()
  }, [count, newestId])

  return (
    <div ref={ref} className="toasts" popover="manual" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon">{ICONS[t.kind]}</span>
          <span className="toast-message">{t.message}</span>
          <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
