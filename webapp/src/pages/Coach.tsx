/* ===========================
   Super Coach Dashboard
   =========================== */

import { useEffect, useMemo, useState } from 'react'
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
import type {
  BehaviorInsight,
  CoachMemory,
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

function asCoachMemory(payload: Record<string, unknown>): CoachMemory | null {
  if (!payload || !Array.isArray(payload.goals)) return null
  return payload as unknown as CoachMemory
}

export default function Coach() {
  useTelegramBackButton(true)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mission, setMission] = useState<DailyMission | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const [drills, setDrills] = useState<MnemonicDrill[]>([])
  const [skillGraph, setSkillGraph] = useState<SkillGraph | null>(null)
  const [proof, setProof] = useState<ProgressProof | null>(null)
  const [memory, setMemory] = useState<CoachMemory | null>(null)
  const [insights, setInsights] = useState<BehaviorInsight[]>([])
  const [speakFirst, setSpeakFirst] = useState<SpeakFirstPlan | null>(null)
  const [comfortMode, setComfortMode] = useState(false)
  const [diagnosisInput, setDiagnosisInput] = useState('')
  const [diagnosisResult, setDiagnosisResult] = useState<Record<string, unknown> | null>(null)
  const [shareCard, setShareCard] = useState<Record<string, unknown> | null>(null)
  const [goalsInput, setGoalsInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const missionCompletion = useMemo(() => {
    if (!mission) return 0
    return Math.round((completed.length / Math.max(1, mission.tasks.length)) * 100)
  }, [completed, mission])

  const loadDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, d, sg, pp, mem, ins, sp, sc] = await Promise.all([
        getDailyMission(),
        getMnemonicDrills(5),
        getCoachSkillGraph(),
        getCoachProgressProof(30),
        getCoachMemory(),
        getCoachInsights(30),
        getSpeakFirstPlan(comfortMode),
        getShareCard(30),
      ])

      setMission(asDailyMission(m))
      setDrills(((d.drills as unknown[]) || []) as MnemonicDrill[])
      setSkillGraph(asSkillGraph(sg))
      setProof(asProgressProof(pp))
      setMemory(asCoachMemory(mem))
      setInsights(((ins.insights as unknown[]) || []) as BehaviorInsight[])
      setSpeakFirst(sp as unknown as SpeakFirstPlan)
      setShareCard((sc.card as Record<string, unknown>) || null)
      setGoalsInput((mem.goals as string[] | undefined)?.join('; ') || '')
      setNotesInput((mem.notes as string | undefined) || '')
      setCompleted([])
    } catch (e) {
      console.error(e)
      setError('Failed to load Super Coach dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comfortMode])

  const toggleTask = (taskId: string) => {
    setCompleted((prev) => (
      prev.includes(taskId)
        ? prev.filter((item) => item !== taskId)
        : [...prev, taskId]
    ))
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

  const handleSaveMemory = async () => {
    setSaving(true)
    try {
      const goals = goalsInput
        .split(';')
        .map((g) => g.trim())
        .filter(Boolean)
      const updated = await updateCoachMemory({
        goals,
        notes: notesInput,
      })
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
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-3xl animate-spin-slow">Loading...</span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Super Coach</h1>
        <p className="text-sm text-tg-hint">Daily loop: recall, fix, speak.</p>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {mission && (
        <section className="bg-tg-section rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Daily Mission ({mission.total_minutes} min)</h2>
            <span className="text-xs text-tg-hint">{mission.difficulty}</span>
          </div>
          <p className="text-xs text-tg-hint mt-1">
            Best window: {mission.best_time_to_practice.window}
          </p>
          <div className="mt-3 space-y-2">
            {mission.tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="w-full text-left bg-tg-secondary rounded-xl p-3"
              >
                <div className="flex items-start gap-3">
                  <span>{completed.includes(task.id) ? '[x]' : '[ ]'}</span>
                  <div>
                    <p className="font-medium text-sm">{task.title} ({task.duration_min}m)</p>
                    <p className="text-xs text-tg-hint">{task.instruction}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-tg-hint">Completion: {missionCompletion}%</p>
            <button
              disabled={saving}
              onClick={handleCompleteMission}
              className="px-4 py-2 rounded-xl bg-tg-button text-tg-button-text text-sm"
            >
              {saving ? 'Saving...' : 'Complete Mission'}
            </button>
          </div>
        </section>
      )}

      <section className="bg-tg-section rounded-2xl p-4">
        <h2 className="font-semibold">Error Recurrence Mnemonics</h2>
        <div className="mt-3 space-y-2">
          {drills.length === 0 && <p className="text-sm text-tg-hint">No recurring errors yet.</p>}
          {drills.map((drill) => (
            <div key={`${drill.error_code}-${drill.style}`} className="bg-tg-secondary rounded-xl p-3">
              <p className="text-sm font-medium">{drill.error_code} ({drill.style})</p>
              <p className="text-xs text-tg-hint mt-1">{drill.mnemonic}</p>
              <div className="flex gap-2 mt-2">
                {[3, 4, 5].map((score) => (
                  <button
                    key={score}
                    onClick={() => handleMnemonicFeedback(drill, score)}
                    className="px-2 py-1 rounded-lg text-xs bg-tg-button text-tg-button-text"
                  >
                    {score}/5
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {skillGraph && (
        <section className="bg-tg-section rounded-2xl p-4">
          <h2 className="font-semibold">Skill Graph</h2>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-tg-secondary rounded-xl p-3">
              <p className="text-xs text-tg-hint uppercase">Top Weak</p>
              {skillGraph.top_weak.map((s) => (
                <p key={s.skill_id} className="text-sm mt-1">{s.label}: {s.score}</p>
              ))}
            </div>
            <div className="bg-tg-secondary rounded-xl p-3">
              <p className="text-xs text-tg-hint uppercase">Top Improving</p>
              {skillGraph.top_improving.length === 0 && (
                <p className="text-sm mt-1 text-tg-hint">More data needed</p>
              )}
              {skillGraph.top_improving.map((s) => (
                <p key={s.skill_id} className="text-sm mt-1">{s.label}: +{s.trend_delta}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {proof && (
        <section className="bg-tg-section rounded-2xl p-4">
          <h2 className="font-semibold">Proof of Progress</h2>
          <p className="text-xs text-tg-hint mt-1">
            Confidence: {Math.round((proof.confidence || 0) * 100)}% ({proof.status})
          </p>
          {proof.highlights && (
            <ul className="mt-2 space-y-1">
              {proof.highlights.slice(0, 3).map((h) => (
                <li key={h} className="text-sm">- {h}</li>
              ))}
            </ul>
          )}
          {proof.deltas && (
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="bg-tg-secondary rounded-lg p-2">Band d: {proof.deltas.band_delta}</div>
              <div className="bg-tg-secondary rounded-lg p-2">Filler d: {proof.deltas.filler_rate_delta}%</div>
              <div className="bg-tg-secondary rounded-lg p-2">WPM d: {proof.deltas.wpm_delta}</div>
              <div className="bg-tg-secondary rounded-lg p-2">Grammar d: {proof.deltas.grammar_accuracy_delta}</div>
            </div>
          )}
        </section>
      )}

      <section className="bg-tg-section rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Speak-First Mode</h2>
          <button
            onClick={() => setComfortMode((v) => !v)}
            className="px-3 py-1 rounded-lg bg-tg-secondary text-xs"
          >
            {comfortMode ? 'Comfort ON' : 'Comfort OFF'}
          </button>
        </div>
        <div className="space-y-2 mt-3">
          {speakFirst?.drills.map((d) => (
            <div key={d.id} className="bg-tg-secondary rounded-xl p-3">
              <p className="text-sm font-medium">{d.title} ({d.duration_min}m)</p>
              <p className="text-xs text-tg-hint">{d.instruction}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-tg-section rounded-2xl p-4">
        <h2 className="font-semibold">2-minute Diagnosis</h2>
        <textarea
          value={diagnosisInput}
          onChange={(e) => setDiagnosisInput(e.target.value)}
          placeholder="Paste short speaking transcript..."
          className="w-full mt-2 rounded-xl bg-tg-secondary p-3 text-sm min-h-[110px]"
        />
        <button
          disabled={saving || diagnosisInput.trim().length < 20}
          onClick={handleDiagnosis}
          className="mt-2 px-4 py-2 rounded-xl bg-tg-button text-tg-button-text text-sm disabled:opacity-60"
        >
          Run Diagnosis
        </button>
        {diagnosisResult && (
          <div className="mt-3 bg-tg-secondary rounded-xl p-3 text-sm">
            <p>Estimated band: <b>{String(diagnosisResult.estimated_band || '-')}</b></p>
            <p className="text-xs text-tg-hint mt-1">
              {Array.isArray(diagnosisResult.top_actions)
                ? (diagnosisResult.top_actions as string[]).join(' | ')
                : ''}
            </p>
          </div>
        )}
      </section>

      {memory && (
        <section className="bg-tg-section rounded-2xl p-4">
          <h2 className="font-semibold">Coach Memory</h2>
          <p className="text-xs text-tg-hint mt-1">{memory.panel_hint}</p>
          <label className="block text-xs mt-3 mb-1 text-tg-hint">Goals (separate with ;)</label>
          <input
            value={goalsInput}
            onChange={(e) => setGoalsInput(e.target.value)}
            className="w-full rounded-xl bg-tg-secondary p-2 text-sm"
          />
          <label className="block text-xs mt-3 mb-1 text-tg-hint">Notes</label>
          <textarea
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            className="w-full rounded-xl bg-tg-secondary p-2 text-sm min-h-[90px]"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSaveMemory}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-tg-button text-tg-button-text text-sm"
            >
              Save Memory
            </button>
            <button
              onClick={handleClearMemory}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm"
            >
              Clear
            </button>
          </div>
        </section>
      )}

      <section className="bg-tg-section rounded-2xl p-4">
        <h2 className="font-semibold">What Are We Not Seeing?</h2>
        <div className="space-y-2 mt-3">
          {insights.length === 0 && <p className="text-sm text-tg-hint">No insights yet.</p>}
          {insights.map((insight, idx) => (
            <div key={`${insight.risk}-${idx}`} className="bg-tg-secondary rounded-xl p-3">
              <p className="text-sm font-medium">{insight.what_am_i_not_seeing}</p>
              <p className="text-xs text-tg-hint mt-1">Action: {insight.action}</p>
            </div>
          ))}
        </div>
      </section>

      {shareCard && (
        <section className="bg-tg-section rounded-2xl p-4">
          <h2 className="font-semibold">Share Card Preview</h2>
          <div className="mt-2 bg-tg-secondary rounded-xl p-3">
            <p className="text-sm font-medium">{String(shareCard.title || 'Progress')}</p>
            <p className="text-sm mt-1">{String(shareCard.win_text || '')}</p>
            <p className="text-xs text-tg-hint mt-1">{String(shareCard.personal_tip || '')}</p>
          </div>
        </section>
      )}
    </div>
  )
}

