import type { ReactNode } from 'react'

export interface EditorFieldProps {
  label: ReactNode
  /** Id of the single control the label names (renders a real <label>). */
  htmlFor?: string
  /**
   * For composite controls: the label text gets this id instead, so the control can use
   * aria-labelledby. With `group`, children are also wrapped in role=group.
   */
  labelId?: string
  group?: boolean
  /** Id for the hint/error line so controls can point at it with aria-describedby. */
  messageId?: string
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  /** Small text at the right end of the label row (e.g. a count). */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Label + control(s) + hint/error, styled like the kit's Field. Unlike Field it links the
 * message to the control and leaves error borders to `aria-invalid`, so in multi-control
 * fields only the control at fault turns red.
 */
export function EditorField({
  label,
  htmlFor,
  labelId,
  group = false,
  messageId,
  hint,
  error,
  required = false,
  aside,
  className = '',
  children,
}: EditorFieldProps) {
  const labelContent = (
    <>
      {label}
      {required && (
        <span className="editor-required" aria-hidden="true">
          *
        </span>
      )}
    </>
  )
  return (
    <div className={`field editor-field ${className}`}>
      <div className="editor-field-top">
        {htmlFor ? (
          <label className="field-label" htmlFor={htmlFor}>
            {labelContent}
          </label>
        ) : (
          <span className="field-label" id={labelId}>
            {labelContent}
          </span>
        )}
        {aside != null && aside !== false && <span className="editor-field-aside">{aside}</span>}
      </div>
      {group ? (
        <div role="group" aria-labelledby={labelId} className="editor-field-group">
          {children}
        </div>
      ) : (
        children
      )}
      {error ? (
        <div className="field-error editor-field-message" id={messageId}>
          {error}
        </div>
      ) : hint ? (
        <div className="field-hint editor-field-message" id={messageId}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}
