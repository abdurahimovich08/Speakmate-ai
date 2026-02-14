/* StreakBadge — Fire icon with streak count, server-driven warning */

import { motion } from 'framer-motion'

interface Props {
  streak: number
  todayCompleted: boolean
  compact?: boolean
  freezeAvailable?: boolean
  isComeback?: boolean
  streakWarning?: string | null
}

export default function StreakBadge({
  streak,
  todayCompleted,
  compact = false,
  freezeAvailable = false,
  isComeback = false,
  streakWarning = null,
}: Props) {
  const isActive = streak > 0
  const needsAction = !todayCompleted && streak > 0

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className={`text-sm ${isActive ? '' : 'grayscale opacity-50'}`}>🔥</span>
        <span className="text-xs font-bold tabular-nums">{streak}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <motion.div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl border transition-colors ${
          isActive
            ? 'bg-orange-500/10 border-orange-500/20'
            : 'bg-sm-card2 border-sm-border'
        }`}
        animate={needsAction ? {
          rotate: [0, -2, 2, -2, 2, 0],
        } : {}}
        transition={{ duration: 0.5, repeat: needsAction ? Infinity : 0, repeatDelay: 5 }}
      >
        <motion.span
          className="text-lg"
          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          🔥
        </motion.span>
        <div className="leading-none">
          <p className="text-sm font-bold tabular-nums">{streak}</p>
          <p className="text-[10px] text-sm-muted">
            {isComeback ? 'qaytdingiz!' : 'streak'}
          </p>
        </div>
        {needsAction && freezeAvailable && (
          <span className="text-[10px] text-blue-400 font-medium">❄️ Freeze</span>
        )}
      </motion.div>
      {/* Server-driven warning: local-date aware */}
      {streakWarning && (
        <p className="text-[10px] text-orange-400 font-medium px-1">{streakWarning}</p>
      )}
    </div>
  )
}
