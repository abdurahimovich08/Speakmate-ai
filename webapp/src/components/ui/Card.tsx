import { type HTMLAttributes } from 'react'
import { motion } from 'framer-motion'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`sm-card ${className}`} />
}

export function SoftCard({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`sm-card-soft ${className}`} />
}

export function GlassCard({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`sm-glass rounded-smxl ${className}`} />
}

export function AnimatedCard({
  className = '',
  delay = 0,
  ...props
}: HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`sm-card ${className}`}
      {...(props as Record<string, unknown>)}
    />
  )
}
