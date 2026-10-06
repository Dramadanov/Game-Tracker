import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../../state/store'

const ICONS = {
  success: <CheckCircle2 size={16} />,
  error: <TriangleAlert size={16} />,
  info: <Info size={16} />,
}

/** Bottom-right stack of transient messages. Errors stay longer and are announced assertively. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts" aria-live="polite">
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
