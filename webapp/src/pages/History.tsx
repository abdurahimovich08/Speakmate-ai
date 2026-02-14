/* ===========================
   History - Premium session timeline with charts
   =========================== */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useSessionStore } from '../stores/sessionStore'
import { getSessionHistory } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, SoftCard, GlassCard } from '../components/ui/Card'
import ProgressChart from '../components/gamification/ProgressChart'
import ActivityCalendar from '../components/gamification/ActivityCalendar'

const modeMeta: Record<
  string,
  { label: string; kicker: string; gradient: string }
> = {
  free_speaking: {
    label: 'Free Speaking',
    kicker: 'Talk freely, get corrected fast',
    gradient: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy))',
  },
  ielts_test: {
    label: 'IELTS Test',
    kicker: 'Full-band scoring with structure',
    gradient: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2))',
  },
  training: {
    label: 'Training',
    kicker: 'Fix one weakness at a time',
    gradient: 'linear-gradient(90deg, var(--sm-energy-2), var(--sm-energy))',
  },
}

function formatWhen(value?: string) {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function History() {
  const navigate = useNavigate()
  useTelegramBackButton(true)
  const { sessions, loadingSessions, loadSessions } = useSessionStore()
  const [chartData, setChartData] = useState<Array<{ date: string; band: number }>>([])
  const [activityMap, setActivityMap] = useState<Record<string, number>>({})
  const [monthStats, setMonthStats] = useState({ sessions: 0, minutes: 0, growth: 0 })

  useEffect(() => {
    loadSessions()
    getSessionHistory(90)
      .then((resp: Record<string, unknown>) => {
        const sessionList = (resp.sessions || []) as Array<Record<string, unknown>>
        const map = (resp.activity_map || {}) as Record<string, number>
        setActivityMap(map)

        const points = sessionList
          .filter((s) => typeof s.band === 'number')
          .map((s) => ({ date: String(s.date), band: Number(s.band) }))
          .reverse()
        setChartData(points)

        // Monthly stats
        const totalSessions = sessionList.length
        const totalMinutes = sessionList.reduce(
          (acc, s) => acc + Math.round(Number(s.duration_seconds || 0) / 60),
          0,
        )
        const bands = points.map((p) => p.band)
        const growth =
          bands.length >= 2 ? bands[bands.length - 1] - bands[0] : 0
        setMonthStats({ sessions: totalSessions, minutes: totalMinutes, growth: Math.round(growth * 10) / 10 })
      })
      .catch(() => {})
  }, [loadSessions])

  return (
    <motion.div
      className="p-4 font-ui"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <Card className="p-4 mb-4 overflow-hidden relative">
          <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy2 via-transparent to-sm-accent" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Timeline</p>
            <h1 className="text-2xl font-semibold font-display mt-1">History</h1>
          </div>
        </Card>
      </motion.div>

      {/* Month stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3 mb-4">
        <SoftCard className="p-3 text-center">
          <p className="text-lg font-bold tabular-nums">{monthStats.sessions}</p>
          <p className="text-[10px] text-sm-muted">Sessiya</p>
        </SoftCard>
        <SoftCard className="p-3 text-center">
          <p className="text-lg font-bold tabular-nums">{monthStats.minutes}m</p>
          <p className="text-[10px] text-sm-muted">Mashq</p>
        </SoftCard>
        <SoftCard className="p-3 text-center">
          <p className={`text-lg font-bold tabular-nums ${monthStats.growth > 0 ? 'text-sm-energy' : monthStats.growth < 0 ? 'text-sm-danger' : ''}`}>
            {monthStats.growth > 0 ? '+' : ''}{monthStats.growth.toFixed(1)}
          </p>
          <p className="text-[10px] text-sm-muted">O'sish</p>
        </SoftCard>
      </motion.div>

      {/* Band trend chart */}
      {chartData.length >= 2 && (
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-2 font-semibold">
              Band trendi
            </p>
            <ProgressChart data={chartData} height={160} />
          </GlassCard>
        </motion.div>
      )}

      {/* Activity calendar */}
      {Object.keys(activityMap).length > 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted mb-3 font-semibold">
              Faollik
            </p>
            <ActivityCalendar activityMap={activityMap} weeks={12} />
          </GlassCard>
        </motion.div>
      )}

      {/* Loading */}
      {loadingSessions && sessions.length === 0 && (
        <div className="flex items-center justify-center py-14">
          <SoftCard className="px-4 py-3">
            <p className="text-sm text-sm-muted">Loading sessions...</p>
          </SoftCard>
        </div>
      )}

      {/* Empty state */}
      {!loadingSessions && sessions.length === 0 && (
        <SoftCard className="p-5 text-center">
          <p className="text-sm font-medium tracking-tight">Hali sessiyalar yo'q</p>
          <p className="text-xs text-sm-muted mt-2 leading-relaxed">
            Birinchi practice qiling. Coach sizga xatolar, tavsiyalar va skill grafni chiqarib beradi.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="lg" onClick={() => navigate('/practice')}>
              Boshlash
            </Button>
          </div>
        </SoftCard>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <motion.div className="space-y-3" variants={stagger}>
          {sessions.map((s, i) => {
            const meta = modeMeta[s.mode] || modeMeta.free_speaking
            const band = s.overall_scores?.overall_band
            const mins = Math.max(0, Math.round((s.duration_seconds || 0) / 60))
            const when = formatWhen(s.created_at)

            return (
              <motion.button
                key={s.id}
                variants={fadeUp}
                whileTap={{ scale: 0.985 }}
                onClick={() => navigate(`/results/${s.id}`)}
                className="w-full text-left sm-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: meta.gradient }}
                      />
                      <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
                        {meta.label}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tracking-tight mt-2 truncate">
                      {s.topic || meta.kicker}
                    </p>
                    <p className="text-xs text-sm-muted mt-1">
                      {when ? `${when} · ` : ''}
                      {mins} min
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {typeof band === 'number' ? (
                      <div className="inline-flex flex-col items-end">
                        <p className="text-2xl font-semibold font-display tabular-nums leading-none">
                          {band.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-sm-muted uppercase tracking-[0.22em] mt-1">
                          band
                        </p>
                      </div>
                    ) : (
                      <div className="inline-flex flex-col items-end">
                        <p className="text-sm font-medium text-sm-muted">—</p>
                        <p className="text-[10px] text-sm-muted uppercase tracking-[0.22em] mt-1">
                          pending
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            )
          })}

          <div className="pt-2">
            <Button variant="ghost" onClick={() => navigate('/practice')} className="w-full">
              Yangi practice
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
