import { useId, useMemo } from 'react'

export function ScoreRing({
  value,
  label,
  size = 120,
}: {
  value: number
  label?: string
  size?: number
}) {
  const rawId = useId()
  const gradientId = useMemo(() => {
    const safe = rawId.replace(/[^a-zA-Z0-9_-]/g, '')
    return `smRing${safe || '0'}`
  }, [rawId])
  const radius = useMemo(() => Math.max(18, Math.floor(size / 2) - 10), [size])
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius])
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(9, value)) : 0
  const progress = clamped / 9
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--sm-accent)" />
            <stop offset="55%" stopColor="var(--sm-energy-2)" />
            <stop offset="100%" stopColor="var(--sm-energy)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--sm-border)"
          strokeWidth="10"
          opacity="0.35"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transform: `rotate(-90deg)`,
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 600ms ease',
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-semibold font-display leading-none tabular-nums">
          {clamped.toFixed(1)}
        </div>
        {label && <div className="text-[11px] text-sm-muted mt-1">{label}</div>}
      </div>
    </div>
  )
}
