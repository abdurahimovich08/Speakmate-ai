/* ===========================
   History - Premium session timeline
   =========================== */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useSessionStore } from '../stores/sessionStore'
import { Button } from '../components/ui/Button'
import { Card, SoftCard } from '../components/ui/Card'

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

export default function History() {
  const navigate = useNavigate()
  useTelegramBackButton(true)
  const { sessions, loadingSessions, loadSessions } = useSessionStore()

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  return (
    <div className="p-4 animate-fade-in font-ui">
      <Card className="p-4 mb-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy2 via-transparent to-sm-accent" />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
            Timeline
          </p>
          <h1 className="text-2xl font-semibold font-display mt-1">History</h1>
          <p className="text-xs text-sm-muted mt-2">
            Har sessiya bu rep. Natijani oching, xatolarni ko'ring, keyingi qadamni bajaring.
          </p>
        </div>
      </Card>

      {loadingSessions && sessions.length === 0 && (
        <div className="flex items-center justify-center py-14">
          <SoftCard className="px-4 py-3">
            <p className="text-sm text-sm-muted">Loading sessions...</p>
          </SoftCard>
        </div>
      )}

      {!loadingSessions && sessions.length === 0 && (
        <SoftCard className="p-5 text-center">
          <p className="text-sm font-medium tracking-tight">Hali sessiyalar yo'q</p>
          <p className="text-xs text-sm-muted mt-2 leading-relaxed">
            10-15 minutlik birinchi practice qiling. Biz sizga xatolar, tavsiyalar va skill grafni chiqarib beramiz.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="lg" onClick={() => navigate('/practice')}>
              Boshlash
            </Button>
          </div>
        </SoftCard>
      )}

      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => {
            const meta = modeMeta[s.mode] || modeMeta.free_speaking
            const band = s.overall_scores?.overall_band
            const mins = Math.max(0, Math.round((s.duration_seconds || 0) / 60))
            const when = formatWhen(s.created_at)

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/results/${s.id}`)}
                className="w-full text-left sm-card p-4 transition-transform active:scale-[0.985]"
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
              </button>
            )
          })}

          <div className="pt-2">
            <Button variant="ghost" onClick={() => navigate('/practice')} className="w-full">
              Yangi practice
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
