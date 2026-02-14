/* ===========================
   Home Page — Premium redesign with streak, XP, goals, progress
   =========================== */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useGamificationStore } from '../stores/gamificationStore'
import { getDailyMission, getUserStats, getSessionHistory } from '../services/api'
import { telegramService } from '../services/telegram'
import { getGreeting } from '../utils/greetings'
import StreakBadge from '../components/gamification/StreakBadge'
import XPBar from '../components/gamification/XPBar'
import ProgressChart from '../components/gamification/ProgressChart'
import AnimatedNumber from '../components/gamification/AnimatedNumber'
import { GlassCard } from '../components/ui/Card'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const { streak, loadStreak } = useGamificationStore()
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [mission, setMission] = useState<Record<string, unknown> | null>(null)
  const [chartData, setChartData] = useState<Array<{ date: string; band: number }>>([])

  useEffect(() => {
    loadStreak()
    getUserStats().then(setStats).catch(() => {})
    getDailyMission().then(setMission).catch(() => {})
    getSessionHistory(30)
      .then((resp: Record<string, unknown>) => {
        const sessions = (resp.sessions || []) as Array<Record<string, unknown>>
        const points = sessions
          .filter((s) => typeof s.band === 'number')
          .map((s) => ({ date: String(s.date), band: Number(s.band) }))
          .reverse()
        setChartData(points)
      })
      .catch(() => {})
  }, [loadStreak])

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
  const totalMinutes = Number(stats?.total_practice_minutes || 0)
  const avgBand = Number(stats?.average_band || 0)

  return (
    <motion.div
      className="p-4 font-ui"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Greeting */}
      <motion.div variants={fadeUp} className="mb-5">
        <h1 className="text-2xl font-bold font-display leading-tight">{greeting}</h1>
      </motion.div>

      {/* Streak + XP Card */}
      {streak && (
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <StreakBadge
                streak={streak.current_streak}
                todayCompleted={streak.today_completed}
              />
              <div className="text-right">
                <p className="text-[10px] text-sm-muted uppercase tracking-wider">Bugun</p>
                <p className="text-sm font-bold">
                  {streak.today_completed ? '✅ Bajarildi' : '0/1 sessiya'}
                </p>
              </div>
            </div>
            <XPBar
              totalXp={streak.total_xp}
              xpToNextLevel={streak.xp_to_next_level}
              level={streak.level}
              levelName={streak.level_name}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* Today's Goal Card (Zeigarnik Effect) */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--sm-card-2)"
                  strokeWidth="2.5"
                />
                <motion.path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--sm-accent)"
                  strokeWidth="2.5"
                  strokeDasharray="100"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{
                    strokeDashoffset: streak?.today_completed ? 0 : 75,
                  }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {streak?.today_completed ? '✓' : '1'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold">Bugungi maqsad</p>
              <p className="text-xs text-sm-muted mt-0.5">
                1 sessiya · 10 daqiqa · 50+ XP
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Mission Card */}
      {mission && (
        <motion.div variants={fadeUp}>
          <Link
            to="/coach"
            className="block sm-glass rounded-smxl p-4 mb-4 active:scale-[0.98] transition-transform overflow-hidden relative"
          >
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-sm-accent to-sm-energy" />
            <div className="relative">
              <p className="text-xs font-bold text-sm-accent uppercase tracking-wider">
                Today's Mission
              </p>
              <p className="text-xs text-sm-muted mt-1">
                {String(mission.total_minutes || 10)} min · {String(mission.difficulty || 'balanced')}
              </p>
              <p className="text-xs mt-2 text-sm-accent font-semibold">Open Super Coach →</p>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Quick Start */}
      <motion.div variants={fadeUp} className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-3 font-semibold">
          Tez boshlash
        </p>
        <div className="grid grid-cols-2 gap-3">
          <QuickStartCard
            to="/practice?mode=free_speaking"
            icon="🎙️"
            title="Mashq boshlash"
            primary
          />
          <QuickStartCard to="/coach" icon="✨" title="Super Coach" />
        </div>
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3 mb-4">
          <StatBox value={totalSessions} label="Sessions" />
          <StatBox value={totalMinutes} label="Minutes" suffix="m" />
          <StatBox value={avgBand} label="Avg Band" decimals={1} />
        </motion.div>
      )}

      {/* Progress Chart */}
      {chartData.length >= 2 && (
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-2 font-semibold">
              Band trendi (oxirgi 30 kun)
            </p>
            <ProgressChart data={chartData} height={150} />
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  )
}

function QuickStartCard({
  to,
  icon,
  title,
  primary,
}: {
  to: string
  icon: string
  title: string
  primary?: boolean
}) {
  return (
    <Link to={to}>
      <motion.div
        whileTap={{ scale: 0.96 }}
        className={`rounded-2xl p-4 text-center border transition-colors ${
          primary
            ? 'bg-tg-button text-tg-button-text border-transparent'
            : 'sm-glass border-sm-border'
        }`}
      >
        <span className="text-2xl block mb-2">{icon}</span>
        <p className="text-sm font-semibold">{title}</p>
      </motion.div>
    </Link>
  )
}

function StatBox({
  value,
  label,
  suffix = '',
  decimals = 0,
}: {
  value: number
  label: string
  suffix?: string
  decimals?: number
}) {
  return (
    <div className="sm-glass rounded-xl p-3 text-center">
      <AnimatedNumber
        value={value}
        decimals={decimals}
        suffix={suffix}
        className="text-xl font-semibold font-display"
      />
      <p className="text-[11px] text-sm-muted mt-0.5">{label}</p>
    </div>
  )
}
