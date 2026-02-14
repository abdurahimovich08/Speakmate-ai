/* ===========================
   Profile - Premium profile with level, achievements, progress chart
   =========================== */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useAuthStore } from '../stores/authStore'
import { useGamificationStore } from '../stores/gamificationStore'
import { getUserStats, updateProfile, getSessionHistory, getErrorFingerprint } from '../services/api'
import { telegramService } from '../services/telegram'
import { Button } from '../components/ui/Button'
import { Card, SoftCard, GlassCard } from '../components/ui/Card'
import StreakBadge from '../components/gamification/StreakBadge'
import XPBar from '../components/gamification/XPBar'
import AchievementGrid from '../components/gamification/AchievementGrid'
import AnimatedNumber from '../components/gamification/AnimatedNumber'

const ProgressChart = lazy(() => import('../components/gamification/ProgressChart'))

const bandOptions = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]
const languageOptions = [
  { value: 'uz', label: "O'zbek" },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function Profile() {
  useTelegramBackButton(true)

  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { streak, loadStreak } = useGamificationStore()

  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [chartData, setChartData] = useState<Array<{ date: string; band: number }>>([])
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [targetBand, setTargetBand] = useState(user?.target_band || 7.0)
  const [nativeLang, setNativeLang] = useState(user?.native_language || 'uz')
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadStreak()
    getUserStats().then(setStats).catch(() => {})
    getSessionHistory(60)
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

  useEffect(() => {
    setFullName(user?.full_name || '')
    setTargetBand(user?.target_band || 7.0)
    setNativeLang(user?.native_language || 'uz')
  }, [user?.full_name, user?.target_band, user?.native_language])

  const tgUser = telegramService.user
  const displayName = (fullName || user?.full_name || tgUser?.first_name || 'User').trim()
  const initials = useMemo(() => {
    const parts = displayName.split(' ').filter(Boolean)
    const a = parts[0]?.[0] || 'U'
    const b = parts[1]?.[0] || ''
    return `${a}${b}`.toUpperCase()
  }, [displayName])

  const totalSessions = safeNumber(stats?.total_sessions) ?? 0
  const totalMinutes = safeNumber(stats?.total_practice_minutes) ?? 0
  const avgBand = safeNumber(stats?.average_band)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateProfile({
        full_name: fullName.trim() || undefined,
        target_band: targetBand,
        native_language: nativeLang,
      })
      useAuthStore.setState({ user: updated })
      telegramService.hapticNotification('success')
    } catch (e) {
      console.error(e)
      telegramService.hapticNotification('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="p-4 font-ui"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Avatar + Level badge */}
      <motion.div variants={fadeUp}>
        <Card className="p-4 mb-4 overflow-hidden relative">
          <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy via-transparent to-sm-accent" />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              {/* Gradient ring around avatar */}
              <div
                className="h-16 w-16 rounded-2xl p-[2px]"
                style={{
                  background: 'linear-gradient(135deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))',
                }}
              >
                <div className="h-full w-full rounded-[14px] bg-sm-bg flex items-center justify-center text-lg font-semibold font-display text-sm-text">
                  {initials}
                </div>
              </div>
              {/* Level badge */}
              {streak && (
                <div className="absolute -bottom-1 -right-1 bg-sm-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
                  Lv.{streak.level}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight truncate">{displayName}</h1>
              {tgUser?.username && (
                <p className="text-xs text-sm-muted mt-0.5 truncate">@{tgUser.username}</p>
              )}
              {streak && (
                <p className="text-xs text-sm-accent font-medium mt-1">{streak.level_name}</p>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Streak + XP */}
      {streak && (
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <StreakBadge
                streak={streak.current_streak}
                todayCompleted={streak.today_completed}
              />
              <div className="text-right text-sm">
                <span className="text-sm-muted">Eng uzun: </span>
                <span className="font-bold">{streak.longest_streak}</span>
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

      {/* Stats grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3 mb-4">
        <SoftCard className="p-3 text-center">
          <AnimatedNumber
            value={totalSessions}
            decimals={0}
            className="text-lg font-bold"
          />
          <p className="text-[10px] text-sm-muted mt-0.5">Sessions</p>
        </SoftCard>
        <SoftCard className="p-3 text-center">
          <AnimatedNumber
            value={totalMinutes}
            decimals={0}
            suffix="m"
            className="text-lg font-bold"
          />
          <p className="text-[10px] text-sm-muted mt-0.5">Mashq</p>
        </SoftCard>
        <SoftCard className="p-3 text-center">
          <AnimatedNumber
            value={avgBand ?? 0}
            decimals={1}
            className="text-lg font-bold"
          />
          <p className="text-[10px] text-sm-muted mt-0.5">Avg Band</p>
        </SoftCard>
      </motion.div>

      {/* Error Fingerprint */}
      <ErrorFingerprintCard />

      {/* Achievements */}
      {streak && streak.achievements && (
        <motion.div variants={fadeUp}>
          <Card className="p-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-3 font-semibold">
              Yutuqlar
            </p>
            <AchievementGrid achievements={streak.achievements} />
          </Card>
        </motion.div>
      )}

      {/* Progress chart */}
      {chartData.length >= 2 && (
        <motion.div variants={fadeUp}>
          <Card className="p-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-2 font-semibold">
              Band trendi
            </p>
            <Suspense fallback={<div className="h-36 flex items-center justify-center text-sm text-sm-muted">Loading chart...</div>}>
              <ProgressChart data={chartData} height={150} />
            </Suspense>
          </Card>
        </motion.div>
      )}

      {/* Settings (collapsible) */}
      <motion.div variants={fadeUp}>
        <Card className="p-4 mb-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Settings</p>
              <h2 className="text-lg font-semibold font-display mt-1">Coach setup</h2>
            </div>
            <motion.span
              animate={{ rotate: showSettings ? 180 : 0 }}
              className="text-sm-muted text-lg"
            >
              ▾
            </motion.span>
          </button>

          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <p className="text-xs text-sm-muted mt-2 leading-relaxed">
                Bu sozlamalar Daily Mission va tavsiyalarni shaxsiylashtiradi.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium tracking-tight">Ism</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masalan: Abdurahim"
                    className="mt-2 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm outline-none focus:border-sm-accent focus-visible:ring-2 focus-visible:ring-[color:var(--sm-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium tracking-tight">Maqsad band</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {bandOptions.map((b) => (
                      <motion.button
                        key={b}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          setTargetBand(b)
                          telegramService.hapticSelection()
                        }}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold tabular-nums border transition-colors ${
                          targetBand === b
                            ? 'bg-tg-button text-tg-button-text border-transparent'
                            : 'bg-sm-card2 text-sm-text border-sm-border'
                        }`}
                      >
                        {b.toFixed(1)}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium tracking-tight">Ona tili</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {languageOptions.map((lang) => (
                      <motion.button
                        key={lang.value}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setNativeLang(lang.value)
                          telegramService.hapticSelection()
                        }}
                        className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                          nativeLang === lang.value
                            ? 'bg-tg-button text-tg-button-text border-transparent'
                            : 'bg-sm-card2 text-sm-text border-sm-border'
                        }`}
                      >
                        {lang.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="ghost" onClick={() => logout()} disabled={saving}>
                    Logout
                  </Button>
                  <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </Card>
      </motion.div>

      {/* Share */}
      <motion.div variants={fadeUp} className="mb-4">
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            const text = `🎙 SpeakMate AI orqali IELTS Speaking mashq qilyapman!\n🔥 ${streak?.current_streak || 0} kunlik streak\n⚡ Level ${streak?.level || 1}: ${streak?.level_name || ''}\n📊 O'rtacha band: ${avgBand?.toFixed(1) || '-'}`
            if (navigator.share) {
              navigator.share({ title: 'SpeakMate Progress', text }).catch(() => {})
            } else {
              navigator.clipboard.writeText(text).catch(() => {})
              telegramService.hapticNotification('success')
            }
          }}
        >
          📤 Natijalarni ulashish
        </Button>
      </motion.div>

      <div className="text-center text-[11px] text-sm-muted pb-4">
        <p>SpeakMate AI v1.0.0</p>
        <p>Platform: {telegramService.platform}</p>
      </div>
    </motion.div>
  )
}

/** Error Fingerprint Card — top 3 recurring mistakes with improvement trend + tips */
function ErrorFingerprintCard() {
  const [errors, setErrors] = useState<Array<{
    category: string
    subcategory: string
    count: number
    trend: 'improving' | 'stable' | 'worsening'
    sessions_without: number
    tip?: string
  }>>([])
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    getErrorFingerprint()
      .then((data) => {
        const items = (data.errors || []) as typeof errors
        setErrors(items)
        setStatus((data.status as string) || '')
      })
      .catch(() => {})
  }, [])

  // Graceful new-user: show encouragement
  if (status === 'new_user') {
    return (
      <motion.div variants={fadeUp}>
        <Card className="p-4 mb-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-2 font-semibold">
            Mening xatolarim
          </p>
          <p className="text-sm text-sm-muted">
            Yana 2-3 ta sessiya qiling — xatolaringiz tahlili bu yerda chiqadi.
          </p>
        </Card>
      </motion.div>
    )
  }

  if (errors.length === 0) return null

  const trendIcon = (t: string) =>
    t === 'improving' ? '↓' : t === 'worsening' ? '↑' : '→'
  const trendColor = (t: string) =>
    t === 'improving' ? 'text-sm-energy' : t === 'worsening' ? 'text-sm-danger' : 'text-sm-muted'

  return (
    <motion.div variants={fadeUp}>
      <Card className="p-4 mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-3 font-semibold">
          Mening xatolarim
        </p>
        <div className="space-y-2.5">
          {errors.slice(0, 3).map((err, i) => (
            <div key={i} className="bg-sm-card2 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">{err.category}</p>
                  <p className="text-[11px] text-sm-muted">{err.subcategory} · {err.count}x</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-bold ${trendColor(err.trend)}`}>
                    {trendIcon(err.trend)}
                  </span>
                  {err.sessions_without >= 3 && (
                    <span className="text-[10px] bg-sm-energy/15 text-sm-energy px-1.5 py-0.5 rounded-lg font-medium">
                      Fix streak!
                    </span>
                  )}
                </div>
              </div>
              {/* Actionable tip */}
              {err.tip && (
                <Link to="/practice" className="block mt-1.5 text-[11px] text-sm-accent hover:underline">
                  → {err.tip}
                </Link>
              )}
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  )
}
