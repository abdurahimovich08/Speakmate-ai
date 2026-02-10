/* ===========================
   Results — Session results with scores and errors
   =========================== */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useSessionStore } from '../stores/sessionStore'
import { getSession, getSessionErrors, getConversation, getSessionFeedback } from '../services/api'
import ScoreCard from '../components/ScoreCard'
import ErrorList from '../components/ErrorList'
import type { Session, DetectedError, ConversationTurn, IELTSScores, SessionFeedback } from '../types'

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useTelegramBackButton(true)

  // Try to get data from store first (just-finished session)
  const storeScores = useSessionStore((s) => s.scores)
  const storeErrors = useSessionStore((s) => s.errors)
  const storeRecommendations = useSessionStore((s) => s.recommendations)
  const storeSession = useSessionStore((s) => s.session)

  const [session, setSession] = useState<Session | null>(
    storeSession?.id === id ? storeSession : null,
  )
  const [scores, setScores] = useState<IELTSScores | null>(
    storeSession?.id === id ? storeScores : null,
  )
  const [errors, setErrors] = useState<DetectedError[]>(
    storeSession?.id === id ? storeErrors : [],
  )
  const [recommendations, setRecommendations] = useState<string[]>(
    storeSession?.id === id ? storeRecommendations : [],
  )
  const [summary, setSummary] = useState<string>('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [tab, setTab] = useState<'scores' | 'errors' | 'chat'>('scores')
  const [loading, setLoading] = useState(!session)

  useEffect(() => {
    if (!id) return
    if (session && scores) return // already have data

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
            setRecommendations(feedback.recommendations)
          }
          if (typeof feedback.summary === 'string') {
            setSummary(feedback.summary)
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-3xl animate-spin-slow">⏳</span>
      </div>
    )
  }

  const duration = session?.duration_seconds || 0
  const minutes = Math.floor(duration / 60)

  return (
    <div className="p-4 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">Sessiya natijalari</h1>
        <p className="text-sm text-tg-hint">
          {session?.topic || session?.mode} · {minutes} daqiqa
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-tg-secondary rounded-xl p-1 mb-4">
        {(['scores', 'errors', 'chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t ? 'bg-tg-section text-tg-text shadow-sm' : 'text-tg-hint'
            }`}
          >
            {t === 'scores' ? '📊 Ballar' : t === 'errors' ? `❌ Xatolar (${errors.length})` : '💬 Chat'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'scores' && scores && <ScoreCard scores={scores} />}

      {tab === 'errors' && <ErrorList errors={errors} />}

      {tab === 'scores' && recommendations.length > 0 && (
        <div className="mt-4 bg-tg-section rounded-xl p-4">
          <h2 className="font-semibold mb-2">Tavsiyalar</h2>
          <ul className="space-y-2 text-sm text-tg-text">
            {recommendations.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-tg-link">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {summary && <p className="text-xs text-tg-hint mt-3">{summary}</p>}
        </div>
      )}

      {tab === 'chat' && (
        <div className="space-y-2">
          {conversation.map((turn, i) => (
            <div
              key={i}
              className={`max-w-[85%] ${turn.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
            >
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  turn.role === 'user'
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary text-tg-text'
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))}
          {conversation.length === 0 && (
            <p className="text-center text-tg-hint py-6">Suhbat ma'lumotlari topilmadi</p>
          )}
        </div>
      )}

      {/* Practice again */}
      <button
        onClick={() => {
          useSessionStore.getState().reset()
          navigate('/practice')
        }}
        className="w-full mt-6 py-3 rounded-xl bg-tg-button text-tg-button-text font-semibold active:scale-[0.98] transition-transform"
      >
        🔄 Yana mashq qilish
      </button>
    </div>
  )
}
