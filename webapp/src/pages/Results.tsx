/* ===========================
   Results - Comprehensive IELTS session report
   Tabs: Overview | Fluency | Vocabulary | Grammar | Pronunciation | Errors
   =========================== */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useSessionStore } from '../stores/sessionStore'
import {
  getSession,
  getSessionErrors,
  getConversation,
  getSessionFeedback,
  getSessionAnalysis,
} from '../services/api'
import ErrorList from '../components/ErrorList'
import OverviewTab from '../components/results/OverviewTab'
import CriterionSection from '../components/results/CriterionSection'
import {
  FluencyMetricsGrid,
  LexicalMetricsGrid,
  GrammarMetricsGrid,
} from '../components/results/MetricsGrid'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type {
  Session,
  DetectedError,
  ConversationTurn,
  IELTSScores,
  IELTSCriterionDetail,
  SessionFeedback,
  CoachingTip,
  PronunciationReport,
  TrainingPlan,
  Recommendation,
  FullCriterionFeedback,
  FluencyMetrics,
  LexicalMetrics,
  GrammarMetrics,
} from '../types'

type TabKey = 'overview' | 'fluency' | 'vocabulary' | 'grammar' | 'pronunciation' | 'errors'

function getBand(val: number | IELTSCriterionDetail | undefined): number {
  if (!val) return 0
  if (typeof val === 'number') return val
  return val?.band ?? 0
}

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useTelegramBackButton(true)

  // Store data (available immediately after session ends)
  const storeScores = useSessionStore((s) => s.scores)
  const storeErrors = useSessionStore((s) => s.errors)
  const storeRecommendations = useSessionStore((s) => s.recommendations)
  const storeSession = useSessionStore((s) => s.session)
  const storeCoachingTips = useSessionStore((s) => s.coachingTips)
  const storePronunciation = useSessionStore((s) => s.pronunciation)
  const storeTrainingPlan = useSessionStore((s) => s.trainingPlan)
  const storeCriterionFeedback = useSessionStore((s) => s.criterionFeedback)
  const storeFluencyMetrics = useSessionStore((s) => s.fluencyMetrics)
  const storeLexicalMetrics = useSessionStore((s) => s.lexicalMetrics)
  const storeGrammarMetrics = useSessionStore((s) => s.grammarMetrics)

  const fromStore = storeSession?.id === id

  const [session, setSession] = useState<Session | null>(fromStore ? storeSession : null)
  const [scores, setScores] = useState<IELTSScores | null>(fromStore ? storeScores : null)
  const [errors, setErrors] = useState<DetectedError[]>(fromStore ? storeErrors : [])
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    fromStore ? storeRecommendations : [],
  )
  const [strengths, setStrengths] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [coachingTips] = useState<CoachingTip[]>(fromStore ? storeCoachingTips : [])
  const [pronunciation, setPronunciation] = useState<PronunciationReport | null>(
    fromStore ? storePronunciation : null,
  )
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(
    fromStore ? storeTrainingPlan : null,
  )
  const [criterionFeedback, setCriterionFeedback] = useState<FullCriterionFeedback | null>(
    fromStore ? storeCriterionFeedback : null,
  )
  const [fluencyMetrics, setFluencyMetrics] = useState<FluencyMetrics | null>(
    fromStore ? storeFluencyMetrics : null,
  )
  const [lexicalMetrics, setLexicalMetrics] = useState<LexicalMetrics | null>(
    fromStore ? storeLexicalMetrics : null,
  )
  const [grammarMetrics, setGrammarMetrics] = useState<GrammarMetrics | null>(
    fromStore ? storeGrammarMetrics : null,
  )
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(!session)

  // Fetch data from API if not from store
  useEffect(() => {
    if (!id) return
    if (session && scores) {
      // Still fetch deep analysis for criterion feedback
      getSessionAnalysis(id)
        .then((data) => {
          if (data.criterion_feedback && typeof data.criterion_feedback === 'object') {
            setCriterionFeedback(data.criterion_feedback as unknown as FullCriterionFeedback)
          }
          if (data.fluency_metrics) setFluencyMetrics(data.fluency_metrics as unknown as FluencyMetrics)
          if (data.lexical_metrics) setLexicalMetrics(data.lexical_metrics as unknown as LexicalMetrics)
          if (data.grammar_metrics) setGrammarMetrics(data.grammar_metrics as unknown as GrammarMetrics)
          // Also get pronunciation from deep analysis if not already set
          const analysis = data.analysis as Record<string, unknown> | undefined
          if (analysis?.pronunciation && !pronunciation) {
            setPronunciation(analysis.pronunciation as unknown as PronunciationReport)
          }
        })
        .catch(() => {})
      return
    }

    setLoading(true)
    Promise.all([
      getSession(id),
      getSessionErrors(id),
      getConversation(id),
      getSessionFeedback(id).catch(() => null as SessionFeedback | null),
      getSessionAnalysis(id).catch(() => null),
    ])
      .then(([s, e, c, feedback, analysis]) => {
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

        if (analysis) {
          const a = analysis as Record<string, unknown>
          if (a.criterion_feedback && typeof a.criterion_feedback === 'object') {
            setCriterionFeedback(a.criterion_feedback as unknown as FullCriterionFeedback)
          }
          if (a.fluency_metrics) setFluencyMetrics(a.fluency_metrics as unknown as FluencyMetrics)
          if (a.lexical_metrics) setLexicalMetrics(a.lexical_metrics as unknown as LexicalMetrics)
          if (a.grammar_metrics) setGrammarMetrics(a.grammar_metrics as unknown as GrammarMetrics)

          // Extract scores from analysis if not on session
          if (!s.overall_scores && a.scores) {
            setScores(a.scores as unknown as IELTSScores)
          }
          // Extract pronunciation
          const analysisResult = a.analysis as Record<string, unknown> | undefined
          if (analysisResult?.pronunciation) {
            setPronunciation(analysisResult.pronunciation as unknown as PronunciationReport)
          }
          // Extract recommendations from analysis if not from feedback
          if (!feedback && analysisResult?.recommendations) {
            const recs = analysisResult.recommendations as Array<string | Recommendation>
            setRecommendations(
              recs.map((r) => (typeof r === 'string' ? { recommendation: r } : r)),
            )
          }
          // Extract training plan
          if (analysisResult?.training_plan) {
            setTrainingPlan(analysisResult.training_plan as unknown as TrainingPlan)
          }
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

  const tabs: { key: TabKey; label: string; badge?: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'fluency', label: 'Fluency', badge: String(getBand(scores?.fluency_coherence).toFixed(1)) },
    { key: 'vocabulary', label: 'Vocab', badge: String(getBand(scores?.lexical_resource).toFixed(1)) },
    { key: 'grammar', label: 'Grammar', badge: String(getBand(scores?.grammatical_range).toFixed(1)) },
    { key: 'pronunciation', label: 'Pronun.', badge: String(getBand(scores?.pronunciation).toFixed(1)) },
    { key: 'errors', label: `Errors`, badge: errors.length > 0 ? String(errors.length) : undefined },
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

      {/* Tabs (horizontally scrollable) */}
      <div className="flex bg-sm-card2 rounded-2xl p-1 mb-4 border border-sm-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-2.5 text-xs rounded-xl font-medium transition-all tracking-tight flex items-center gap-1.5 ${
              tab === t.key ? 'bg-sm-card text-sm-text shadow-smcard' : 'text-sm-muted'
            }`}
          >
            {t.label}
            {t.badge && (
              <span className={`text-[10px] tabular-nums ${tab === t.key ? 'opacity-70' : 'opacity-50'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content with slide animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* ========== OVERVIEW TAB ========== */}
          {tab === 'overview' && scores && (
            <OverviewTab
              scores={scores}
              criterionFeedback={criterionFeedback}
              recommendations={recommendations}
              summary={summary}
              trainingPlan={trainingPlan}
              onTabChange={(t) => setTab(t as TabKey)}
            />
          )}

          {/* ========== FLUENCY TAB ========== */}
          {tab === 'fluency' && scores && (
            <CriterionSection
              label="Fluency & Coherence"
              icon="🗣"
              scoreData={scores.fluency_coherence}
              feedback={criterionFeedback?.fluency_coherence}
              metricsSlot={fluencyMetrics ? <FluencyMetricsGrid m={fluencyMetrics} /> : undefined}
            />
          )}

          {/* ========== VOCABULARY TAB ========== */}
          {tab === 'vocabulary' && scores && (
            <CriterionSection
              label="Lexical Resource"
              icon="📖"
              scoreData={scores.lexical_resource}
              feedback={criterionFeedback?.lexical_resource}
              metricsSlot={lexicalMetrics ? <LexicalMetricsGrid m={lexicalMetrics} /> : undefined}
            />
          )}

          {/* ========== GRAMMAR TAB ========== */}
          {tab === 'grammar' && scores && (
            <CriterionSection
              label="Grammatical Range & Accuracy"
              icon="✍️"
              scoreData={scores.grammatical_range}
              feedback={criterionFeedback?.grammatical_range}
              metricsSlot={grammarMetrics ? <GrammarMetricsGrid m={grammarMetrics} /> : undefined}
            />
          )}

          {/* ========== PRONUNCIATION TAB ========== */}
          {tab === 'pronunciation' && scores && (
            <CriterionSection
              label="Pronunciation"
              icon="🎙"
              scoreData={scores.pronunciation}
              feedback={criterionFeedback?.pronunciation}
              metricsSlot={
                pronunciation ? (
                  <PronunciationMetrics pronunciation={pronunciation} />
                ) : undefined
              }
            />
          )}

          {/* ========== ERRORS TAB ========== */}
          {tab === 'errors' && <ErrorList errors={errors} />}
        </motion.div>
      </AnimatePresence>

      {/* No scores fallback */}
      {!scores && tab !== 'errors' && (
        <div className="text-center py-12 text-sm-muted text-sm">
          <p>Analysis is being generated...</p>
          <p className="text-xs mt-2">This may take 1-2 minutes for a detailed report.</p>
        </div>
      )}

      {/* Bottom actions */}
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
   Pronunciation metrics mini-component
   =========================== */

function PronunciationMetrics({ pronunciation }: { pronunciation: PronunciationReport }) {
  const prosody = pronunciation.prosody
  const intel = pronunciation.intelligibility
  const problems = pronunciation.problem_areas || []
  const feedback = pronunciation.feedback || []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {prosody?.speaking_rate_wpm != null && (
          <MiniStat label="Speaking Rate" value={`${Math.round(prosody.speaking_rate_wpm)} WPM`} />
        )}
        {prosody?.filler_rate != null && (
          <MiniStat label="Filler Rate" value={`${(prosody.filler_rate * 100).toFixed(1)}%`} />
        )}
        {prosody?.pause_count != null && (
          <MiniStat label="Pauses" value={String(prosody.pause_count)} />
        )}
        {intel?.avg_confidence != null && (
          <MiniStat label="Clarity" value={`${(intel.avg_confidence * 100).toFixed(0)}%`} />
        )}
      </div>

      {problems.length > 0 && (
        <div>
          <p className="text-[10px] text-sm-muted uppercase tracking-widest mb-2">Problem areas</p>
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

      {feedback.length > 0 && (
        <div>
          <p className="text-[10px] text-sm-muted uppercase tracking-widest mb-2">Expert tips</p>
          <ul className="space-y-1.5 text-xs text-sm-muted">
            {feedback.map((f, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-sm-accent shrink-0" />
                <span className="leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
