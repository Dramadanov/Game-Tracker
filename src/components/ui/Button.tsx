import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
  /** Visually pressed state for toggle buttons. */
  active?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  active,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${active ? ' is-active' : ''} ${className}`}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      {icon}
      {children !== undefined && children !== null && children !== false && <span>{children}</span>}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: used as tooltip and accessible name. */
  label: string
  icon: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  active?: boolean
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  active,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-icon btn-${variant} btn-${size}${active ? ' is-active' : ''} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      {icon}
    </button>
  )
}
