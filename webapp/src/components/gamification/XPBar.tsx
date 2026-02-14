/* XPBar — Animated progress bar showing XP to next level */

import { motion } from 'framer-motion'

interface Props {
  totalXp: number
  xpToNextLevel: number
  level: number
  levelName: string
  xpGained?: number | null
}

export default function XPBar({ totalXp, xpToNextLevel, level, levelName, xpGained }: Props) {
  // Calculate progress percentage within current level
  // We need to figure out where we are in the current level
  const xpInCurrentLevel = xpToNextLevel > 0 ? Math.max(0, 1 - (xpToNextLevel / getLevelXpRange(level))) : 1
  const progress = Math.min(xpInCurrentLevel * 100, 100)

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-sm-accent/15 text-sm-accent px-2 py-0.5 rounded-lg">
            Lv.{level}
          </span>
          <span className="text-xs text-sm-muted">{levelName}</span>
        </div>
        <span className="text-[11px] text-sm-muted tabular-nums">{totalXp} XP</span>
      </div>
      <div className="h-2 rounded-full bg-sm-card2 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy))',
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {xpToNextLevel > 0 && (
        <p className="text-[10px] text-sm-muted mt-1 text-right">
          {xpToNextLevel} XP gacha keyingi daraja
        </p>
      )}

      {/* Floating XP gained animation */}
      {xpGained && xpGained > 0 && (
        <motion.span
          className="absolute -top-2 right-0 text-sm font-bold text-sm-energy"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -30 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          +{xpGained} XP
        </motion.span>
      )}
    </div>
  )
}

function getLevelXpRange(level: number): number {
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500]
  if (level <= 0 || level >= thresholds.length) return 500
  return thresholds[level] - thresholds[level - 1]
}
