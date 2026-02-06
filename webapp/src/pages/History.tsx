/* ===========================
   History — Session history list
   =========================== */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useTelegramBackButton } from '../hooks/useTelegram'

const modeLabels: Record<string, { icon: string; label: string }> = {
  free_speaking: { icon: '💬', label: 'Free Speaking' },
  ielts_test: { icon: '📝', label: 'IELTS Test' },
  training: { icon: '🏋️', label: 'Training' },
}

export default function History() {
  const navigate = useNavigate()
  useTelegramBackButton(true)
  const { sessions, loadingSessions, loadSessions } = useSessionStore()

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  if (loadingSessions && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-3xl animate-spin-slow">⏳</span>
      </div>
    )
  }

  return (
    <div className="p-4 animate-fade-in">
      <h1 className="text-xl font-bold mb-4">📊 Sessiyalar tarixi</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-tg-hint">
          <p className="text-4xl mb-3">📭</p>
          <p>Hali sessiyalar yo'q</p>
          <button
            onClick={() => navigate('/practice')}
            className="mt-4 px-6 py-2 rounded-xl bg-tg-button text-tg-button-text text-sm"
          >
            Birinchi mashqni boshlang
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const mode = modeLabels[s.mode] || modeLabels.free_speaking
            const band = s.overall_scores?.overall_band
            const mins = Math.floor(s.duration_seconds / 60)
            const date = new Date(s.created_at).toLocaleDateString('uz-UZ', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/results/${s.id}`)}
                className="w-full text-left bg-tg-section rounded-xl p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{mode.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{s.topic || mode.label}</p>
                      <p className="text-xs text-tg-hint">{date} · {mins}m</p>
                    </div>
                  </div>
                  {band != null && (
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        band >= 7 ? 'text-green-600' : band >= 6 ? 'text-yellow-600' : 'text-orange-500'
                      }`}>
                        {band.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-tg-hint">band</p>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
