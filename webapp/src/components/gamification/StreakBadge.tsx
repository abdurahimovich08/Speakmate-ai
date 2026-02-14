/* StreakBadge — Fire icon with streak count, glow + shake effects */

import { motion } from 'framer-motion'

interface Props {
  streak: number
  todayCompleted: boolean
  compact?: boolean
}

export default function StreakBadge({ streak, todayCompleted, compact = false }: Props) {
  const isActive = streak > 0
  const isAboutToBreak = !todayCompleted && streak > 0

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className={`text-sm ${isActive ? '' : 'grayscale opacity-50'}`}>🔥</span>
        <span className="text-xs font-bold tabular-nums">{streak}</span>
      </div>
    )
  }

  return (
    <motion.div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl border transition-colors ${
        isActive
          ? 'bg-orange-500/10 border-orange-500/20'
          : 'bg-sm-card2 border-sm-border'
      }`}
      animate={isAboutToBreak ? {
        rotate: [0, -3, 3, -3, 3, 0],
      } : {}}
      transition={{ duration: 0.5, repeat: isAboutToBreak ? Infinity : 0, repeatDelay: 4 }}
    >
      <motion.span
        className="text-lg"
        animate={isActive ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        🔥
      </motion.span>
      <div className="leading-none">
        <p className="text-sm font-bold tabular-nums">{streak}</p>
        <p className="text-[10px] text-sm-muted">streak</p>
      </div>
      {isAboutToBreak && (
        <span className="text-[10px] text-orange-400 font-medium">Saqlang!</span>
      )}
    </motion.div>
  )
}
