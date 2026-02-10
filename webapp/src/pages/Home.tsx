/* ===========================
   Home Page - Welcome and quick actions
   =========================== */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { getDailyMission, getUserStats } from '../services/api'
import { telegramService } from '../services/telegram'

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [mission, setMission] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    getUserStats().then(setStats).catch(() => {})
    getDailyMission().then(setMission).catch(() => {})
  }, [])

  const name = user?.full_name || telegramService.user?.first_name || 'Learner'

  return (
    <div className="p-4 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold font-display">Salom, {name}</h1>
        <p className="text-sm text-sm-muted mt-2">
          Bugungi 10-15 daqiqalik missiya tayyor. Keling, natijani ko'ramiz.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatBox value={String(stats.total_sessions || 0)} label="Sessions" />
          <StatBox value={`${stats.total_practice_minutes || 0}m`} label="Practice" />
          <StatBox value={String(stats.average_band || '-')} label="Avg Band" />
        </div>
      )}

      {mission && (
        <Link to="/coach" className="block sm-card p-4 mb-6 active:scale-[0.98] transition-transform overflow-hidden relative">
          <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-sm-accent to-transparent" />
          <div className="relative">
            <p className="text-sm font-semibold">Today's Mission</p>
            <p className="text-xs text-sm-muted mt-1">
              {String(mission.total_minutes || 10)} min · {String(mission.difficulty || 'balanced')} · best time{' '}
              {String((mission.best_time_to_practice as Record<string, unknown> | undefined)?.window || '18:00-20:00')}
            </p>
            <p className="text-xs mt-3 text-sm-accent font-medium">Open Super Coach</p>
          </div>
        </Link>
      )}

      <h2 className="font-semibold mb-3 text-sm-muted text-xs uppercase tracking-widest">Tez boshlash</h2>
      <div className="space-y-3">
        <ModeCard to="/coach" title="Super Coach" desc="Daily mission, mnemonics, progress proof" />
        <ModeCard to="/practice?mode=free_speaking" title="Free Speaking" desc="Real-time gapirish mashqi" />
        <ModeCard to="/practice?mode=ielts_test" title="IELTS Mock Test" desc="To'liq speaking simulyatsiya" />
        <ModeCard to="/practice?mode=training" title="Training" desc="Takrorlanadigan xatolarni tuzatish" />
      </div>
    </div>
  )
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="sm-card-soft rounded-xl p-3 text-center">
      <p className="text-xl font-semibold mt-1 font-display">{value}</p>
      <p className="text-[11px] text-sm-muted">{label}</p>
    </div>
  )
}

function ModeCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="block sm-card-soft rounded-2xl p-4 active:scale-[0.98] transition-transform">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-sm-muted mt-1">{desc}</p>
      </div>
    </Link>
  )
}
