/* ===========================
   Timer — Session elapsed time display
   =========================== */

import { useState, useEffect, useRef } from 'react'

interface Props {
  running: boolean
  className?: string
  'aria-label'?: string
}

export default function Timer({ running, className = '', 'aria-label': ariaLabel }: Props) {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1)
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <span className={`font-mono tabular-nums ${className}`} aria-label={ariaLabel} role="timer">
      {mm}:{ss}
    </span>
  )
}
