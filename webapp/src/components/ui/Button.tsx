import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
}) {
  const base = 'sm-btn'
  const variantClass =
    variant === 'primary'
      ? 'bg-tg-button text-tg-button-text'
      : variant === 'danger'
        ? 'bg-sm-danger text-white'
        : 'bg-sm-card2 text-sm-text'

  const sizeClass = size === 'lg' ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-sm'
  const disabledClass = props.disabled ? 'opacity-60 active:scale-100' : ''

  return (
    <button
      {...props}
      className={`${base} ${sizeClass} ${variantClass} ${disabledClass} ${className}`}
    >
      {leftIcon}
      <span className="tracking-tight">{children}</span>
    </button>
  )
}

