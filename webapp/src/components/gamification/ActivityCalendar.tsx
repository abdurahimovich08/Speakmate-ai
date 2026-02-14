/* ActivityCalendar — GitHub-style contribution calendar for last 12 weeks */

import { useMemo } from 'react'
import { motion } from 'framer-motion'

interface Props {
  /** Map of date string (YYYY-MM-DD) to session count */
  activityMap: Record<string, number>
  /** Number of weeks to show */
  weeks?: number
}

export default function ActivityCalendar({ activityMap, weeks = 12 }: Props) {
  const grid = useMemo(() => {
    const today = new Date()
    const cells: Array<{ date: string; count: number; col: number; row: number }> = []

    // Calculate start date (weeks * 7 days ago, aligned to Monday)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (weeks * 7) + 1)
    // Align to Monday
    const dayOfWeek = startDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    startDate.setDate(startDate.getDate() + mondayOffset)

    let col = 0
    let row = 0
    const d = new Date(startDate)

    while (d <= today) {
      const key = d.toISOString().split('T')[0]
      cells.push({
        date: key,
        count: activityMap[key] || 0,
        col,
        row,
      })

      row++
      if (row >= 7) {
        row = 0
        col++
      }
      d.setDate(d.getDate() + 1)
    }

    return cells
  }, [activityMap, weeks])

  const maxCount = Math.max(1, ...grid.map((c) => c.count))

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto no-scrollbar pb-1">
        {Array.from({ length: Math.ceil(grid.length / 7) }, (_, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, rowIdx) => {
              const cell = grid.find((c) => c.col === colIdx && c.row === rowIdx)
              if (!cell) return <div key={rowIdx} className="w-3 h-3" />

              const intensity = cell.count === 0 ? 0 : Math.min(cell.count / maxCount, 1)

              return (
                <motion.div
                  key={rowIdx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: (colIdx * 7 + rowIdx) * 0.003 }}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor:
                      intensity === 0
                        ? 'var(--sm-card-2)'
                        : `color-mix(in srgb, var(--sm-energy) ${Math.round(30 + intensity * 70)}%, transparent)`,
                  }}
                  title={`${cell.date}: ${cell.count} session${cell.count !== 1 ? 's' : ''}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-sm-muted">
        <span>Kam</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <div
            key={v}
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor:
                v === 0
                  ? 'var(--sm-card-2)'
                  : `color-mix(in srgb, var(--sm-energy) ${Math.round(30 + v * 70)}%, transparent)`,
            }}
          />
        ))}
        <span>Ko'p</span>
      </div>
    </div>
  )
}
