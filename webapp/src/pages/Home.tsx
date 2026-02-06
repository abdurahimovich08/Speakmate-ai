/* ===========================
   Home Page — Welcome screen with quick actions
   =========================== */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { getUserStats } from '../services/api'
import { telegramService } from '../services/telegram'

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    getUserStats().then(setStats).catch(() => {})
  }, [])

  const name = user?.full_name || telegramService.user?.first_name || 'User'

  return (
    <div className="p-4 animate-fade-in">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Salom, {name}! 👋</h1>
        <p className="text-tg-hint mt-1">IELTS Speaking mashq qilishga tayyormisiz?</p>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatBox
            icon="📚"
            value={String(stats.total_sessions || 0)}
            label="Sessiyalar"
          />
          <StatBox
            icon="⏱"
            value={`${stats.total_practice_minutes || 0}m`}
            label="Mashq vaqti"
          />
          <StatBox
            icon="🎯"
            value={String(stats.average_band || '—')}
            label="O'rtacha band"
          />
        </div>
      )}

      {/* Quick start cards */}
      <h2 className="font-semibold mb-3 text-tg-section-header text-sm uppercase">
        Mashq boshlang
      </h2>

      <div className="space-y-3">
        <ModeCard
          to="/practice?mode=free_speaking"
          icon="💬"
          title="Free Speaking"
          desc="Erkin mavzuda AI bilan suhbatlashing"
          color="bg-blue-50"
        />
        <ModeCard
          to="/practice?mode=ielts_test"
          icon="📝"
          title="IELTS Mock Test"
          desc="Haqiqiy IELTS speaking test simulyatsiyasi"
          color="bg-green-50"
        />
        <ModeCard
          to="/practice?mode=training"
          icon="🏋️"
          title="Training"
          desc="Xatolaringiz bo'yicha maxsus mashqlar"
          color="bg-purple-50"
        />
      </div>

      {/* Recent session */}
      <div className="mt-6">
        <Link
          to="/history"
          className="block text-center text-sm text-tg-link py-3"
        >
          📊 Sessiyalar tarixini ko'rish →
        </Link>
      </div>
    </div>
  )
}

function StatBox({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-tg-section rounded-xl p-3 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-xs text-tg-hint">{label}</p>
    </div>
  )
}

function ModeCard({
  to,
  icon,
  title,
  desc,
  color,
}: {
  to: string
  icon: string
  title: string
  desc: string
  color: string
}) {
  return (
    <Link
      to={to}
      className={`block ${color} rounded-2xl p-4 active:scale-[0.98] transition-transform`}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="font-semibold text-tg-text">{title}</p>
          <p className="text-xs text-tg-hint">{desc}</p>
        </div>
      </div>
    </Link>
  )
}
