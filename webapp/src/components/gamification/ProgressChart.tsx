/* ProgressChart — Line chart showing band scores over time */

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

interface DataPoint {
  date: string
  band: number
}

interface Props {
  data: DataPoint[]
  height?: number
}

export default function ProgressChart({ data, height = 180 }: Props) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.map((d) => ({
      date: new Date(d.date).toLocaleDateString('uz', { day: 'numeric', month: 'short' }),
      band: d.band,
    }))
  }, [data])

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-sm-muted">
        Kamida 2 ta sessiya kerak
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--sm-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--sm-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--sm-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 9]}
            tick={{ fontSize: 10, fill: 'var(--sm-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--sm-card)',
              border: '1px solid var(--sm-border)',
              borderRadius: '12px',
              fontSize: '12px',
            }}
            formatter={(value: unknown) => [`${Number(value).toFixed(1)}`, 'Band']}
          />
          <Area
            type="monotone"
            dataKey="band"
            stroke="var(--sm-accent)"
            strokeWidth={2}
            fill="url(#bandGradient)"
            dot={{ r: 3, fill: 'var(--sm-accent)' }}
            activeDot={{ r: 5, fill: 'var(--sm-accent)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
