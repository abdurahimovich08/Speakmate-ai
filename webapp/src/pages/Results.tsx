/* ===========================
   Results - Premium session report
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
} from '../types'

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useTelegramBackButton(true)

  const storeScores = useSessionStore((s) => s.scores)
  const storeErrors = useSessionStore((s) => s.errors)
  const storeRecommendations = useSessionStore((s) => s.recommendations)
  const storeSession = useSessionStore((s) => s.session)

  const [session, setSession] = useState<Session | null>(storeSession?.id === id ? storeSession : null)
  const [scores, setScores] = useState<IELTSScores | null>(storeSession?.id === id ? storeScores : null)
  const [errors, setErrors] = useState<DetectedError[]>(storeSession?.id === id ? storeErrors : [])
  const [recommendations, setRecommendations] = useState<string[]>(storeSession?.id === id ? storeRecommendations : [])
  const [strengths, setStrengths] = useState<string[]>([])
  const [summary, setSummary] = useState<string>('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [tab, setTab] = useState<'scores' | 'errors' | 'chat'>('scores')
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
          if (Array.isArray(feedback.recommendations)) setRecommendations(feedback.recommendations)
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

  return (
    <div className="p-4 animate-fade-in font-ui">
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

      <div className="flex bg-sm-card2 rounded-2xl p-1 mb-4 border border-sm-border">
        {(['scores', 'errors', 'chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-all tracking-tight ${
              tab === t ? 'bg-sm-card text-sm-text shadow-smcard' : 'text-sm-muted'
            }`}
          >
            {t === 'scores' ? 'Scores' : t === 'errors' ? `Errors (${errors.length})` : 'Chat'}
          </button>
        ))}
      </div>

      {tab === 'scores' && scores && (
        <div className="space-y-4">
          <ScoreCard scores={scores} />

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

          {recommendations.length > 0 && (
            <SoftCard className="rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Next steps</p>
              <ul className="mt-3 space-y-2 text-sm">
                {recommendations.slice(0, 6).map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-accent" />
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
              {summary && <p className="text-xs text-sm-muted mt-3 leading-relaxed">{summary}</p>}
            </SoftCard>
          )}
        </div>
      )}

      {tab === 'errors' && <ErrorList errors={errors} />}

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

