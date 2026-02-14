/* ===========================
   Home Page — Focused: Hero + Mission CTA + Quick Stats
   Principle: Primary CTA + Progress proof. Nothing else.
   =========================== */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useGamificationStore } from '../stores/gamificationStore'
import { getUserStats } from '../services/api'
import { telegramService } from '../services/telegram'
import { getGreeting } from '../utils/greetings'
import StreakBadge from '../components/gamification/StreakBadge'
import XPBar from '../components/gamification/XPBar'
import AnimatedNumber from '../components/gamification/AnimatedNumber'
import { GlassCard } from '../components/ui/Card'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const { streak, loadStreak, mission, loadMission } = useGamificationStore()
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const navigate = useNavigate()

  // Only fire API calls once we have a valid token
  useEffect(() => {
    if (!token) return
    loadStreak()
    loadMission()
    getUserStats().then(setStats).catch(() => {})
  }, [token, loadStreak, loadMission])

  const name = user?.full_name || telegramService.user?.first_name || 'Learner'

  const greeting = useMemo(
    () =>
      getGreeting({
        name,
        streak: streak?.current_streak || 0,
        lastSessionHoursAgo: streak?.last_session_hours_ago ?? null,
        level: streak?.level || 1,
        levelName: streak?.level_name || 'First Words',
      }),
    [name, streak],
  )

  const totalSessions = Number(stats?.total_sessions || 0)
  const avgBand = Number(stats?.average_band || 0)

  return (
    <motion.div
      className="p-4 font-ui"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* ---- Block 1: Greeting + Streak + XP (single hero card) ---- */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-4 mb-4 max-w-md mx-auto">
          <h1 className="text-xl font-bold font-display leading-tight mb-3">{greeting}</h1>
          {streak && (
            <>
              <div className="flex items-center justify-between mb-3">
                <StreakBadge
                  streak={streak.current_streak}
                  todayCompleted={streak.today_completed}
                  freezeAvailable={streak.freeze_available}
                  isComeback={streak.is_comeback}
                  streakWarning={streak.streak_warning}
                />
                <div className="text-right">
                  <p className="text-[10px] text-sm-muted uppercase tracking-wider">Bugun</p>
                  <p className="text-sm font-bold">
                    {streak.today_completed ? 'Bajarildi' : '0/1 sessiya'}
                  </p>
                </div>
              </div>
              <XPBar
                totalXp={streak.total_xp}
                xpToNextLevel={streak.xp_to_next_level}
                level={streak.level}
                levelName={streak.level_name}
              />
            </>
          )}
        </GlassCard>
      </motion.div>

      {/* ---- Block 2: Daily Mission + Primary CTA ---- */}
      <motion.div variants={fadeUp}>
        <button
          onClick={() => {
            if (mission && !mission.completed) {
              navigate(`/practice?mode=${mission.mode || 'free_speaking'}&topic=${encodeURIComponent(mission.title || '')}`)
            } else {
              navigate('/practice?mode=free_speaking')
            }
          }}
          className="w-full text-left sm-card p-4 mb-4 active:scale-[0.98] transition-transform overflow-hidden relative"
        >
          <div className="absolute inset-0 opacity-15 bg-gradient-to-br from-sm-accent to-sm-energy" />
          <div className="relative">
            {mission && !mission.completed ? (
              <>
                <p className="text-[10px] font-bold text-sm-accent uppercase tracking-wider mb-1">
                  Bugungi missiya
                </p>
                <p className="text-base font-semibold tracking-tight">{mission.title}</p>
                <p className="text-xs text-sm-muted mt-1">{mission.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-sm-muted">
                    {mission.minutes || 6} min · +{mission.xp_bonus || 40} XP bonus
                  </span>
                  <span className="text-xs font-bold text-sm-accent">Boshlash →</span>
                </div>
              </>
            ) : mission?.completed ? (
              <>
                <p className="text-[10px] font-bold text-sm-energy uppercase tracking-wider mb-1">
                  Missiya bajarildi!
                </p>
                <p className="text-base font-semibold tracking-tight">Ajoyib! Yana mashq qiling</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-sm-muted">Erkin mashq</span>
                  <span className="text-xs font-bold text-sm-accent">Boshlash →</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold text-sm-accent uppercase tracking-wider mb-1">
                  Mashq boshlash
                </p>
                <p className="text-base font-semibold tracking-tight">Bugun nima qilasiz?</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-sm-muted">Erkin gaplashing, xatolarni toping</span>
                  <span className="text-xs font-bold text-sm-accent">Boshlash →</span>
                </div>
              </>
            )}
          </div>
        </button>
      </motion.div>

      {/* ---- Block 3: Quick stats (tappable — link to relevant pages) ---- */}
      {stats && (
        <motion.div variants={fadeUp} className="flex items-center justify-around py-3 mb-2">
          <Link to="/history" className="text-center flex-1 active:scale-95 transition-transform">
            <AnimatedNumber
              value={totalSessions}
              decimals={0}
              className="text-lg font-semibold font-display"
            />
            <p className="text-[10px] text-sm-muted mt-0.5">Sessions</p>
          </Link>
          <div className="w-px h-8 bg-sm-border" />
          <Link to="/history" className="text-center flex-1 active:scale-95 transition-transform">
            <AnimatedNumber
              value={avgBand}
              decimals={1}
              className="text-lg font-semibold font-display"
            />
            <p className="text-[10px] text-sm-muted mt-0.5">Avg Band</p>
          </Link>
          <div className="w-px h-8 bg-sm-border" />
          <Link to="/profile" className="text-center flex-1 active:scale-95 transition-transform">
            <p className="text-lg font-semibold font-display tabular-nums">
              {streak?.current_streak || 0}
            </p>
            <p className="text-[10px] text-sm-muted mt-0.5">Streak</p>
          </Link>
        </motion.div>
      )}

      {/* Secondary links */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
        <Link
          to="/coach"
          className="sm-card p-3 text-center active:scale-[0.97] transition-transform"
        >
          <span className="text-xl block mb-1">✨</span>
          <p className="text-xs font-semibold">Super Coach</p>
        </Link>
        <Link
          to="/history"
          className="sm-card p-3 text-center active:scale-[0.97] transition-transform"
        >
          <span className="text-xl block mb-1">📊</span>
          <p className="text-xs font-semibold">Tarix</p>
        </Link>
      </motion.div>
    </motion.div>
  )
}
