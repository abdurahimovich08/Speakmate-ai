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
        <h1 className="text-2xl font-bold">Hello, {name}</h1>
        <p className="text-tg-hint mt-1">Your Super Coach daily flow is ready.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatBox value={String(stats.total_sessions || 0)} label="Sessions" />
          <StatBox value={`${stats.total_practice_minutes || 0}m`} label="Practice" />
          <StatBox value={String(stats.average_band || '-')} label="Avg Band" />
        </div>
      )}

      {mission && (
        <Link to="/coach" className="block bg-blue-50 rounded-2xl p-4 mb-6 active:scale-[0.98] transition-transform">
          <p className="text-sm font-semibold text-blue-800">Today's Mission</p>
          <p className="text-xs text-blue-700 mt-1">
            {String(mission.total_minutes || 10)} min - {String(mission.difficulty || 'balanced')} - best time {String((mission.best_time_to_practice as Record<string, unknown> | undefined)?.window || '18:00-20:00')}
          </p>
          <p className="text-xs text-blue-700 mt-2">Open Super Coach Dashboard</p>
        </Link>
      )}

      <h2 className="font-semibold mb-3 text-tg-section-header text-sm uppercase">Quick Start</h2>
      <div className="space-y-3">
        <ModeCard to="/coach" title="Super Coach" desc="Daily mission, mnemonics, and progress proof" color="bg-amber-50" />
        <ModeCard to="/practice?mode=free_speaking" title="Free Speaking" desc="Start active speaking practice" color="bg-blue-50" />
        <ModeCard to="/practice?mode=ielts_test" title="IELTS Mock Test" desc="Run a full speaking simulation" color="bg-green-50" />
        <ModeCard to="/practice?mode=training" title="Training" desc="Fix recurring mistakes" color="bg-purple-50" />
      </div>
    </div>
  )
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-tg-section rounded-xl p-3 text-center">
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-xs text-tg-hint">{label}</p>
    </div>
  )
}

function ModeCard({ to, title, desc, color }: { to: string; title: string; desc: string; color: string }) {
  return (
    <Link to={to} className={`block ${color} rounded-2xl p-4 active:scale-[0.98] transition-transform`}>
      <div>
        <p className="font-semibold text-tg-text">{title}</p>
        <p className="text-xs text-tg-hint">{desc}</p>
      </div>
    </Link>
  )
}
