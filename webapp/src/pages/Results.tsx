/* ===========================
   Results - Comprehensive IELTS session report
   Tabs: Scores | Errors | Pronunciation | Tips | Training | Chat
   =========================== */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useSessionStore } from '../stores/sessionStore'
import { getSession, getSessionErrors, getConversation, getSessionFeedback } from '../services/api'
import ScoreCard from '../components/ScoreCard'
import ErrorList from '../components/ErrorList'
import { Button } from '../components/ui/Button'
import { Card, SoftCard } from '../components/ui/Card'
import type {
  Session,
  DetectedError,
  ConversationTurn,
  IELTSScores,
  SessionFeedback,
  CoachingTip,
  PronunciationReport,
  TrainingPlan,
  Recommendation,
} from '../types'

type TabKey = 'scores' | 'errors' | 'tips' | 'chat'

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useTelegramBackButton(true)

  const storeScores = useSessionStore((s) => s.scores)
  const storeErrors = useSessionStore((s) => s.errors)
  const storeRecommendations = useSessionStore((s) => s.recommendations)
  const storeSession = useSessionStore((s) => s.session)
  const storeCoachingTips = useSessionStore((s) => s.coachingTips)
  const storePronunciation = useSessionStore((s) => s.pronunciation)
  const storeTrainingPlan = useSessionStore((s) => s.trainingPlan)

  const fromStore = storeSession?.id === id

  const [session, setSession] = useState<Session | null>(fromStore ? storeSession : null)
  const [scores, setScores] = useState<IELTSScores | null>(fromStore ? storeScores : null)
  const [errors, setErrors] = useState<DetectedError[]>(fromStore ? storeErrors : [])
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    fromStore ? storeRecommendations : [],
  )
  const [strengths, setStrengths] = useState<string[]>([])
  const [summary, setSummary] = useState<string>('')
  const [coachingTips, setCoachingTips] = useState<CoachingTip[]>(fromStore ? storeCoachingTips : [])
  const [pronunciation, setPronunciation] = useState<PronunciationReport | null>(
    fromStore ? storePronunciation : null,
  )
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(
    fromStore ? storeTrainingPlan : null,
  )
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [tab, setTab] = useState<TabKey>('scores')
  const [loading, setLoading] = useState(!session)

  useEffect(() => {
    if (!id) return
    if (session && scores) return

    setLoading(true)
    Promise.all([
      getSession(id),
      getSessionErrors(id),
      getConversation(id),
      getSessionFeedback(id).catch(() => null as SessionFeedback | null),
    ])
      .then(([s, e, c, feedback]) => {
        setSession(s)
        setScores(s.overall_scores || null)
        setErrors(e)
        setConversation(c)
        if (feedback) {
          if (Array.isArray(feedback.recommendations)) {
            setRecommendations(
              feedback.recommendations.map((r: string | Recommendation) =>
                typeof r === 'string' ? { recommendation: r } : r,
              ),
            )
          }
          if (Array.isArray(feedback.strengths)) setStrengths(feedback.strengths)
          if (typeof feedback.summary === 'string') setSummary(feedback.summary)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen font-ui">
        <div className="sm-card p-4">
          <p className="text-sm text-sm-muted">Loading session report...</p>
        </div>
      </div>
    )
  }

  const duration = session?.duration_seconds || 0
  const minutes = Math.max(0, Math.floor(duration / 60))

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'scores', label: 'Scores' },
    { key: 'errors', label: `Errors (${errors.length})` },
    { key: 'tips', label: `Tips (${coachingTips.length})` },
    { key: 'chat', label: 'Chat' },
  ]

  return (
    <div className="p-4 animate-fade-in font-ui">
      {/* Header */}
      <Card className="p-4 mb-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy2 via-transparent to-sm-accent" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Session report</p>
            <h1 className="text-2xl font-semibold font-display mt-1">Natijalar</h1>
            <p className="text-xs text-sm-muted mt-2 truncate">
              {session?.topic || session?.mode || 'session'} · {minutes} min
            </p>
          </div>
          <div className="shrink-0">
            <Button
              variant="ghost"
              onClick={() => {
                useSessionStore.getState().reset()
                navigate('/practice')
              }}
            >
              Practice
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex bg-sm-card2 rounded-2xl p-1 mb-4 border border-sm-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs rounded-xl font-medium transition-all tracking-tight ${
              tab === t.key ? 'bg-sm-card text-sm-text shadow-smcard' : 'text-sm-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== Scores Tab ========== */}
      {tab === 'scores' && scores && (
        <div className="space-y-4">
          <ScoreCard scores={scores} />

          {/* Pronunciation Summary */}
          {pronunciation && (
            <PronunciationCard pronunciation={pronunciation} />
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <SoftCard className="rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Strengths</p>
              <ul className="mt-3 space-y-2 text-sm">
                {strengths.slice(0, 3).map((s, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-energy" />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </SoftCard>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <SoftCard className="rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Next steps</p>
              <ul className="mt-3 space-y-2 text-sm">
                {recommendations.slice(0, 6).map((rec, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-accent" />
                    <div className="leading-relaxed">
                      {typeof rec === 'string' ? rec : (
                        <>
                          {rec.area && <span className="font-medium">{rec.area}: </span>}
                          {rec.recommendation}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {summary && <p className="text-xs text-sm-muted mt-3 leading-relaxed">{summary}</p>}
            </SoftCard>
          )}

          {/* Training Plan */}
          {trainingPlan && trainingPlan.daily_tasks && trainingPlan.daily_tasks.length > 0 && (
            <TrainingPlanCard plan={trainingPlan} />
          )}
        </div>
      )}

      {/* ========== Errors Tab ========== */}
      {tab === 'errors' && <ErrorList errors={errors} />}

      {/* ========== Coaching Tips Tab ========== */}
      {tab === 'tips' && <CoachingTipsList tips={coachingTips} />}

      {/* ========== Chat Tab ========== */}
      {tab === 'chat' && (
        <div className="space-y-2">
          {conversation.map((turn, i) => (
            <div key={i} className={`max-w-[88%] ${turn.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm border border-sm-border ${
                  turn.role === 'user' ? 'bg-tg-button text-tg-button-text' : 'bg-sm-card2 text-sm-text'
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))}
          {conversation.length === 0 && (
            <p className="text-center text-sm-muted py-10">Conversation not found.</p>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => navigate('/coach')}>
          Super Coach
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            useSessionStore.getState().reset()
            navigate('/practice')
          }}
        >
          Practice again
        </Button>
      </div>
    </div>
  )
}

/* ===========================
   Sub-components
   =========================== */

function PronunciationCard({ pronunciation }: { pronunciation: PronunciationReport }) {
  const prosody = pronunciation.prosody
  const intelligibility = pronunciation.intelligibility
  const feedback = pronunciation.feedback || []
  const problems = pronunciation.problem_areas || []

  return (
    <SoftCard className="rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Pronunciation Report</p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {prosody?.speaking_rate_wpm != null && (
          <MiniStat label="Speaking Rate" value={`${Math.round(prosody.speaking_rate_wpm)} WPM`} />
        )}
        {prosody?.filler_rate != null && (
          <MiniStat label="Filler Rate" value={`${(prosody.filler_rate * 100).toFixed(1)}%`} />
        )}
        {prosody?.pause_count != null && (
          <MiniStat label="Pauses" value={String(prosody.pause_count)} />
        )}
        {intelligibility?.avg_confidence != null && (
          <MiniStat
            label="Clarity"
            value={`${(intelligibility.avg_confidence * 100).toFixed(0)}%`}
          />
        )}
      </div>

      {/* Problem sounds */}
      {problems.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-sm-muted uppercase tracking-widest mb-2">Problem areas</p>
          <div className="flex flex-wrap gap-1.5">
            {problems.map((p, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-1 rounded-full bg-sm-card2 border border-sm-border"
              >
                {p.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs text-sm-muted">
          {feedback.map((f, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-sm-accent shrink-0" />
              <span className="leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </SoftCard>
  )
}

function CoachingTipsList({ tips }: { tips: CoachingTip[] }) {
  if (tips.length === 0) {
    return (
      <div className="text-center py-12 text-sm-muted text-sm">
        No coaching tips for this session.
      </div>
    )
  }

  const severityColor: Record<string, string> = {
    major: 'border-red-500/30 bg-red-500/5',
    moderate: 'border-yellow-500/30 bg-yellow-500/5',
    minor: 'border-blue-500/30 bg-blue-500/5',
  }

  const categoryEmoji: Record<string, string> = {
    grammar: '✍️',
    vocabulary: '📖',
    fluency: '🗣',
    pronunciation: '🎙',
  }

  return (
    <div className="space-y-3">
      {tips.map((tip, i) => (
        <div
          key={i}
          className={`rounded-2xl border p-4 ${severityColor[tip.severity] || severityColor.minor}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{categoryEmoji[tip.category] || '💡'}</span>
            <span className="text-xs font-medium uppercase tracking-wider text-sm-muted">
              {tip.category}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                tip.severity === 'major'
                  ? 'bg-red-500/20 text-red-300'
                  : tip.severity === 'moderate'
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              {tip.severity}
            </span>
          </div>

          {tip.original && (
            <div className="text-sm mb-1.5">
              <span className="line-through text-sm-muted">{tip.original}</span>
              <span className="mx-2 text-sm-muted">→</span>
              <span className="text-sm-energy font-medium">{tip.corrected}</span>
            </div>
          )}

          <p className="text-sm leading-relaxed">{tip.tip}</p>
        </div>
      ))}
    </div>
  )
}

function TrainingPlanCard({ plan }: { plan: TrainingPlan }) {
  const tasks = plan.daily_tasks || []
  const focusAreas = plan.focus_areas || []

  return (
    <SoftCard className="rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
        7-day Training Plan
      </p>

      {focusAreas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
          {focusAreas.map((area, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-1 rounded-full bg-sm-accent/10 border border-sm-accent/30 text-sm-accent"
            >
              {area}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {tasks.slice(0, 7).map((day) => (
          <div key={day.day} className="flex items-start gap-3 text-sm">
            <span className="text-xs text-sm-muted font-medium w-9 shrink-0 pt-0.5">
              Day {day.day}
            </span>
            <div className="flex-1">
              <p className="font-medium text-sm">{day.focus}</p>
              <ul className="text-xs text-sm-muted mt-0.5 space-y-0.5">
                {day.tasks.map((t, j) => (
                  <li key={j}>• {t}</li>
                ))}
              </ul>
            </div>
            <span className="text-[10px] text-sm-muted shrink-0">{day.estimated_minutes}m</span>
          </div>
        ))}
      </div>
    </SoftCard>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm-card-soft rounded-xl p-2.5">
      <p className="text-[10px] text-sm-muted uppercase tracking-widest">{label}</p>
      <p className="text-sm font-semibold mt-0.5 tabular-nums">{value}</p>
    </div>
  )
}
