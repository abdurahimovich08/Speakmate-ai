/* AnimatedNumber — Count-up animation for scores, XP, stats */

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  duration?: number
  decimals?: number
  className?: string
  prefix?: string
  suffix?: string
}

export default function AnimatedNumber({
  value,
  duration = 800,
  decimals = 1,
  className = '',
  prefix = '',
  suffix = '',
}: Props) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = performance.now()

    const step = (now: number) => {
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = fromRef.current + (value - fromRef.current) * eased
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  )
}
