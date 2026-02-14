/* ===========================
   Super Coach - Premium daily coach dashboard
   =========================== */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { telegramService } from '../services/telegram'
import {
  clearCoachMemory,
  completeDailyMission,
  getCoachInsights,
  getCoachMemory,
  getCoachProgressProof,
  getCoachSkillGraph,
  getDailyMission,
  getMnemonicDrills,
  getQuickDiagnosis,
  getShareCard,
  getSpeakFirstPlan,
  submitMnemonicFeedback,
  updateCoachMemory,
} from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, SoftCard } from '../components/ui/Card'
import { CoachSkeleton } from '../components/ui/Skeleton'
import CoachMission from '../components/coach/CoachMission'
import CoachDrills from '../components/coach/CoachDrills'
import CoachSkillGraph from '../components/coach/CoachSkillGraph'
import CoachProgress from '../components/coach/CoachProgress'
import CoachMemory from '../components/coach/CoachMemory'
import CoachInsights from '../components/coach/CoachInsights'
import type {
  BehaviorInsight,
  CoachMemory as CoachMemoryType,
  DailyMission,
  MnemonicDrill,
  ProgressProof,
  SkillGraph,
  SpeakFirstPlan,
} from '../types'

function asDailyMission(payload: Record<string, unknown>): DailyMission | null {
  if (!payload || typeof payload.mission_id !== 'string') return null
  return payload as unknown as DailyMission
}

function asSkillGraph(payload: Record<string, unknown>): SkillGraph | null {
  if (!payload || !Array.isArray(payload.heatmap)) return null
  return payload as unknown as SkillGraph
}

function asProgressProof(payload: Record<string, unknown>): ProgressProof | null {
  if (!payload || typeof payload !== 'object') return null
  if ('proof' in payload && typeof payload.proof === 'object' && payload.proof) {
    return payload.proof as ProgressProof
  }
  return payload as unknown as ProgressProof
}

function asCoachMemory(payload: Record<string, unknown>): CoachMemoryType | null {
  if (!payload || !Array.isArray(payload.goals)) return null
  return payload as unknown as CoachMemoryType
}

export default function Coach() {
  useTelegramBackButton(true)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mission, setMission] = useState<DailyMission | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const [drills, setDrills] = useState<MnemonicDrill[]>([])
  const [skillGraph, setSkillGraph] = useState<SkillGraph | null>(null)
  const [proof, setProof] = useState<ProgressProof | null>(null)
  const [memory, setMemory] = useState<CoachMemoryType | null>(null)
  const [insights, setInsights] = useState<BehaviorInsight[]>([])
  const [speakFirst, setSpeakFirst] = useState<SpeakFirstPlan | null>(null)
  const [comfortMode, setComfortMode] = useState(false)
  const [diagnosisInput, setDiagnosisInput] = useState('')
  const [diagnosisResult, setDiagnosisResult] = useState<Record<string, unknown> | null>(null)
  const [shareCard, setShareCard] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = async () => {
    setLoading(true)
    setError(null)
    const primary = await Promise.allSettled([
      getDailyMission(),
      getMnemonicDrills(5),
      getCoachSkillGraph(),
      getCoachProgressProof(30),
    ])

    const [missionRes, drillsRes, skillRes, proofRes] = primary

    if (missionRes.status === 'fulfilled') {
      setMission(asDailyMission(missionRes.value))
      setCompleted([])
    }
    if (drillsRes.status === 'fulfilled') {
      setDrills((((drillsRes.value as Record<string, unknown>).drills as unknown[]) || []) as MnemonicDrill[])
    }
    if (skillRes.status === 'fulfilled') {
      setSkillGraph(asSkillGraph(skillRes.value))
    }
    if (proofRes.status === 'fulfilled') {
      setProof(asProgressProof(proofRes.value))
    }

    const failedPrimary = primary.filter((r) => r.status === 'rejected').length
    if (failedPrimary === primary.length) {
      setError('Super Coach load failed. Backend is likely waking up, please retry.')
    } else if (failedPrimary > 0) {
      setError('Some coach blocks failed to load. Pull to refresh in a few seconds.')
    }

    setLoading(false)

    const secondary = await Promise.allSettled([
      getCoachMemory(),
      getCoachInsights(30),
      getSpeakFirstPlan(comfortMode),
      getShareCard(30),
    ])

    const [memoryRes, insightsRes, speakRes, shareRes] = secondary
    if (memoryRes.status === 'fulfilled') {
      setMemory(asCoachMemory(memoryRes.value))
    }
    if (insightsRes.status === 'fulfilled') {
      setInsights(((((insightsRes.value as Record<string, unknown>).insights as unknown[]) || []) as BehaviorInsight[]))
    }
    if (speakRes.status === 'fulfilled') {
      setSpeakFirst(speakRes.value as unknown as SpeakFirstPlan)
    }
    if (shareRes.status === 'fulfilled') {
      setShareCard(((shareRes.value as Record<string, unknown>).card as Record<string, unknown>) || null)
    }
  }

  useEffect(() => {
    loadDashboard().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comfortMode])

  const toggleTask = (taskId: string) => {
    setCompleted((prev) =>
      prev.includes(taskId) ? prev.filter((item) => item !== taskId) : [...prev, taskId],
    )
    telegramService.hapticSelection()
  }

  const handleCompleteMission = async () => {
    if (!mission) return
    setSaving(true)
    try {
      await completeDailyMission(mission.mission_id, completed.length, mission.tasks.length, 4)
      telegramService.hapticNotification('success')
      await loadDashboard()
    } catch (e) {
      console.error(e)
      telegramService.hapticNotification('error')
    } finally {
      setSaving(false)
    }
  }

  const handleMnemonicFeedback = async (drill: MnemonicDrill, helpfulness: number) => {
    try {
      await submitMnemonicFeedback(drill.error_code, drill.style, helpfulness)
      telegramService.hapticSelection()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveMemory = async (goals: string[], notes: string) => {
    setSaving(true)
    try {
      const updated = await updateCoachMemory({ goals, notes })
      setMemory(asCoachMemory(updated))
      telegramService.hapticNotification('success')
    } catch (e) {
      console.error(e)
      telegramService.hapticNotification('error')
    } finally {
      setSaving(false)
    }
  }

  const handleClearMemory = async () => {
    setSaving(true)
    try {
      await clearCoachMemory()
      await loadDashboard()
      telegramService.hapticNotification('success')
    } catch (e) {
      console.error(e)
      telegramService.hapticNotification('error')
    } finally {
      setSaving(false)
    }
  }

  const handleDiagnosis = async () => {
    if (!diagnosisInput.trim()) return
    setSaving(true)
    try {
      const result = await getQuickDiagnosis(diagnosisInput.trim())
      setDiagnosisResult(result)
      telegramService.hapticNotification('success')
    } catch (e) {
      console.error(e)
      telegramService.hapticNotification('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <CoachSkeleton />
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in font-ui">
      {/* Header */}
      <Card className="p-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy via-transparent to-sm-accent" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Super Coach</p>
            <h1 className="text-2xl font-semibold font-display mt-1">Daily loop</h1>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">
              10-15 minut: Recall → Fix → Speak. Energiya bilan, lekin aniq.
            </p>
            {error && <p className="text-xs text-sm-danger mt-3" role="alert">{error}</p>}
          </div>
          <div className="shrink-0 flex flex-col gap-2">
            <Button variant="ghost" onClick={() => loadDashboard()} disabled={saving}>
              Reload
            </Button>
            <Button variant="primary" onClick={() => navigate('/practice')}>
              Practice
            </Button>
          </div>
        </div>
      </Card>

      {/* Daily Mission */}
      {mission && (
        <CoachMission
          mission={mission}
          completed={completed}
          saving={saving}
          onToggleTask={toggleTask}
          onMarkAll={() => {
            setCompleted(mission.tasks.map((t) => t.id))
            telegramService.hapticSelection()
          }}
          onComplete={handleCompleteMission}
        />
      )}

      {/* Mnemonic Drills */}
      <CoachDrills drills={drills} onFeedback={handleMnemonicFeedback} />

      {/* Skill Graph + Progress Proof */}
      <div className="grid grid-cols-1 gap-4">
        {skillGraph && <CoachSkillGraph skillGraph={skillGraph} />}
        {proof && <CoachProgress proof={proof} />}
      </div>

      {/* Speak-First Drills */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Speak-first</p>
            <h2 className="text-lg font-semibold tracking-tight mt-1">Active drills</h2>
          </div>
          <Button variant="ghost" onClick={() => setComfortMode((v) => !v)}>
            {comfortMode ? 'Comfort ON' : 'Comfort OFF'}
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {speakFirst?.drills?.map((d) => (
            <SoftCard key={d.id} className="p-4">
              <p className="text-sm font-semibold tracking-tight">
                {d.title} <span className="text-xs text-sm-muted">({d.duration_min}m)</span>
              </p>
              <p className="text-xs text-sm-muted mt-2 leading-relaxed">{d.instruction}</p>
            </SoftCard>
          ))}
          {!speakFirst?.drills?.length && (
            <p className="text-sm text-sm-muted">No drills yet.</p>
          )}
        </div>
      </Card>

      {/* Quick Diagnosis */}
      <Card className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Acquisition</p>
        <h2 className="text-lg font-semibold tracking-tight mt-1">2-minute diagnosis</h2>
        <p className="text-xs text-sm-muted mt-2 leading-relaxed">
          Qisqa transcript tashlang. Coach sizga band + top 3 action beradi.
        </p>
        <textarea
          value={diagnosisInput}
          onChange={(e) => setDiagnosisInput(e.target.value)}
          placeholder="Paste short speaking transcript..."
          className="mt-3 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm min-h-[110px] outline-none"
          aria-label="Speaking transcript for diagnosis"
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => setDiagnosisInput('')} disabled={saving || !diagnosisInput.trim()}>
            Clear
          </Button>
          <Button variant="primary" disabled={saving || diagnosisInput.trim().length < 20} onClick={handleDiagnosis}>
            {saving ? 'Running...' : 'Run diagnosis'}
          </Button>
        </div>
        {diagnosisResult && (
          <SoftCard className="p-4 mt-4">
            <p className="text-sm">
              Estimated band:{' '}
              <b className="tabular-nums">{String(diagnosisResult.estimated_band || '—')}</b>
            </p>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">
              {Array.isArray(diagnosisResult.top_actions)
                ? (diagnosisResult.top_actions as string[]).join(' | ')
                : ''}
            </p>
          </SoftCard>
        )}
      </Card>

      {/* Coach Memory */}
      {memory && (
        <CoachMemory
          memory={memory}
          saving={saving}
          onSave={handleSaveMemory}
          onClear={handleClearMemory}
        />
      )}

      {/* Insights + Share Card */}
      <CoachInsights insights={insights} shareCard={shareCard} />
    </div>
  )
}
