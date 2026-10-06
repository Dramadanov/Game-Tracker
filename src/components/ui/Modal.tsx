import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

export interface ModalProps {
  open: boolean
  onClose(): void
  title: ReactNode
  /** Optional element shown under the title. */
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Extra class on the dialog element. */
  className?: string
  /** When false, Esc and backdrop clicks do nothing (e.g. unsaved changes prompts handle it). */
  dismissable?: boolean
}

/**
 * Modal dialog built on the native <dialog> element: top layer, focus trapping and
 * Esc handling come from the browser. Closing always goes through `onClose`.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className = '',
  dismissable = true,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dismissableRef = useRef(dismissable)
  dismissableRef.current = dismissable

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      const previouslyFocused = document.activeElement as HTMLElement | null
      dialog.showModal()
      return () => {
        if (dialog.open) dialog.close()
        previouslyFocused?.focus?.()
      }
    }
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      // Esc: keep the dialog open and let the owner decide.
      event.preventDefault()
      if (dismissableRef.current) onCloseRef.current()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size} ${className}`}
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        // Backdrop click: the event target is the dialog itself, outside its content box.
        if (event.target !== ref.current || !dismissable) return
        const rect = ref.current.getBoundingClientRect()
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        if (!inside) onClose()
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div className="modal-titles">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <IconButton label="Close" icon={<X size={18} />} onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  )
}
