import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  className = '',
  children,
  disabled,
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
  const disabledClass = disabled ? 'opacity-60' : ''

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...(props as Record<string, unknown>)}
      disabled={disabled}
      className={`${base} ${sizeClass} ${variantClass} ${disabledClass} ${className}`}
    >
      {leftIcon}
      <span className="tracking-tight">{children}</span>
    </motion.button>
  )
}
