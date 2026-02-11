/* ===========================
   Super Coach - Premium daily coach dashboard
   =========================== */

import { useEffect, useMemo, useState } from 'react'
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

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function pct(n: number) {
  return `${Math.round(clamp01(n) * 100)}%`
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
    return clamp01(completed.length / Math.max(1, mission.tasks.length))
  }, [completed, mission])

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
      const memoryPayload = asCoachMemory(memoryRes.value)
      setMemory(memoryPayload)
      setGoalsInput(((memoryRes.value.goals as string[] | undefined) || []).join('; '))
      setNotesInput((memoryRes.value.notes as string | undefined) || '')
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

  const handleSaveMemory = async () => {
    setSaving(true)
    try {
      const goals = goalsInput
        .split(';')
        .map((g) => g.trim())
        .filter(Boolean)
      const updated = await updateCoachMemory({ goals, notes: notesInput })
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
      <div className="p-4 font-ui">
        <Card className="p-4">
          <p className="text-sm text-sm-muted">Loading your coach...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in font-ui">
      <Card className="p-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy via-transparent to-sm-accent" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Super Coach</p>
            <h1 className="text-2xl font-semibold font-display mt-1">Daily loop</h1>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">
              10-15 minut: Recall → Fix → Speak. Energiya bilan, lekin aniq.
            </p>
            {error && <p className="text-xs text-sm-danger mt-3">{error}</p>}
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

      {mission && (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Today</p>
              <h2 className="text-lg font-semibold tracking-tight mt-1">
                Daily Mission ({mission.total_minutes} min)
              </h2>
              <p className="text-xs text-sm-muted mt-2">
                Best window: {mission.best_time_to_practice.window} · Difficulty: {mission.difficulty}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Completion</p>
              <p className="text-2xl font-semibold font-display tabular-nums mt-1">
                {pct(missionCompletion)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {mission.tasks.map((task) => {
              const done = completed.includes(task.id)
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="w-full text-left sm-card-soft rounded-2xl p-4 transition-transform active:scale-[0.985]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-xl border border-sm-border ${
                        done ? 'bg-tg-button text-tg-button-text' : 'bg-sm-card2 text-sm-muted'
                      }`}
                    >
                      {done ? '✓' : ''}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight">
                        {task.title} <span className="text-xs text-sm-muted">({task.duration_min}m)</span>
                      </p>
                      <p className="text-xs text-sm-muted mt-1 leading-relaxed">{task.instruction}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setCompleted(mission.tasks.map((t) => t.id))
                telegramService.hapticSelection()
              }}
            >
              Mark all
            </Button>
            <Button
              variant="primary"
              disabled={saving || completed.length === 0}
              onClick={handleCompleteMission}
            >
              {saving ? 'Saving...' : 'Complete'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Fix fast</p>
            <h2 className="text-lg font-semibold tracking-tight mt-1">Mnemonic drills</h2>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">
              Agar xato 3 marta takrorlansa, biz uni "memory hook" bilan mixlab, qayta-qayta eslatamiz.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {drills.length === 0 && (
            <SoftCard className="p-4">
              <p className="text-sm text-sm-muted">Hali recurring error yo'q. Gapiring, biz topamiz.</p>
            </SoftCard>
          )}

          {drills.map((drill) => (
            <SoftCard key={`${drill.error_code}-${drill.style}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight truncate">
                    {drill.error_code}
                    <span className="text-xs text-sm-muted"> · {drill.style}</span>
                  </p>
                  <p className="text-xs text-sm-muted mt-2 leading-relaxed">{drill.mnemonic}</p>
                </div>
                <div className="shrink-0 text-[11px] text-sm-muted">
                  {drill.category}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    onClick={() => handleMnemonicFeedback(drill, score)}
                    className="py-2 rounded-xl text-xs font-semibold bg-sm-card2 border border-sm-border text-sm-text active:scale-[0.98] transition-transform"
                  >
                    {score}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-sm-muted mt-2">
                Rate: 1 = useless, 5 = sticks in your head.
              </p>
            </SoftCard>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {skillGraph && (
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Map</p>
            <h2 className="text-lg font-semibold tracking-tight mt-1">Skill graph</h2>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">
              Level emas, micro-skill. Eng kuchli 2 va eng zaif 3 fokus.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <SoftCard className="p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Top weak</p>
                <div className="mt-3 space-y-2">
                  {skillGraph.top_weak.slice(0, 3).map((s) => (
                    <div key={s.skill_id}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium tracking-tight">{s.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{s.score.toFixed(1)}</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-sm-card2 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((Math.max(0, Math.min(9, s.score)) / 9) * 100)}%`,
                            background: 'linear-gradient(90deg, var(--sm-energy-2), var(--sm-accent))',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {skillGraph.top_weak.length === 0 && (
                    <p className="text-sm text-sm-muted">More data needed.</p>
                  )}
                </div>
              </SoftCard>

              <SoftCard className="p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Top improving</p>
                <div className="mt-3 space-y-2">
                  {skillGraph.top_improving.slice(0, 3).map((s) => (
                    <div key={s.skill_id} className="flex items-center justify-between">
                      <p className="text-sm font-medium tracking-tight">{s.label}</p>
                      <p className="text-sm font-semibold tabular-nums text-sm-success">
                        +{s.trend_delta.toFixed(1)}
                      </p>
                    </div>
                  ))}
                  {skillGraph.top_improving.length === 0 && (
                    <p className="text-sm text-sm-muted">More sessions → more signal.</p>
                  )}
                </div>
              </SoftCard>
            </div>

            {skillGraph.focus_recommendation?.length ? (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Focus</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {skillGraph.focus_recommendation.slice(0, 3).map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-energy" />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        )}

        {proof && (
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Proof</p>
            <h2 className="text-lg font-semibold tracking-tight mt-1">Progress dashboard</h2>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">
              Eng katta retention savol: "Men o'tgan haftadan yaxshimanmi?" Bu yerda javob bor.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <SoftCard className="p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Status</p>
                <p className="text-lg font-semibold mt-2 tracking-tight">{proof.status}</p>
                <p className="text-xs text-sm-muted mt-1">Confidence: {pct(proof.confidence || 0)}</p>
              </SoftCard>

              <SoftCard className="p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Weekly vibe</p>
                <p className="text-sm mt-2 leading-relaxed">
                  {proof.status === 'needs_more_data'
                    ? "Ko'proq session kerak. 3-5 ta practice qiling, keyin trend aniq bo'ladi."
                    : 'Trend bor. Endi eng zaif 1 skillni 7 kun bosib ketamiz.'}
                </p>
              </SoftCard>
            </div>

            {proof.deltas && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <SoftCard className="p-3">
                  Band Δ: <b>{proof.deltas.band_delta}</b>
                </SoftCard>
                <SoftCard className="p-3">
                  Filler Δ: <b>{proof.deltas.filler_rate_delta}%</b>
                </SoftCard>
                <SoftCard className="p-3">
                  WPM Δ: <b>{proof.deltas.wpm_delta}</b>
                </SoftCard>
                <SoftCard className="p-3">
                  Grammar Δ: <b>{proof.deltas.grammar_accuracy_delta}</b>
                </SoftCard>
              </div>
            )}

            {proof.highlights?.length ? (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Highlights</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {proof.highlights.slice(0, 3).map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-accent" />
                      <span className="leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        )}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Speak-first</p>
            <h2 className="text-lg font-semibold tracking-tight mt-1">Active drills</h2>
          </div>
          <Button
            variant="ghost"
            onClick={() => setComfortMode((v) => !v)}
          >
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
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button
            variant="ghost"
            onClick={() => setDiagnosisInput('')}
            disabled={saving || diagnosisInput.trim().length === 0}
          >
            Clear
          </Button>
          <Button
            variant="primary"
            disabled={saving || diagnosisInput.trim().length < 20}
            onClick={handleDiagnosis}
          >
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

      {memory && (
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Personalization</p>
          <h2 className="text-lg font-semibold tracking-tight mt-1">Coach memory</h2>
          <p className="text-xs text-sm-muted mt-2 leading-relaxed">{memory.panel_hint}</p>

          <label className="block text-xs mt-4 text-sm-muted">Goals (separate with ;)</label>
          <input
            value={goalsInput}
            onChange={(e) => setGoalsInput(e.target.value)}
            className="mt-2 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm outline-none"
          />

          <label className="block text-xs mt-4 text-sm-muted">Notes</label>
          <textarea
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            className="mt-2 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm min-h-[90px] outline-none"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={handleClearMemory} disabled={saving}>
              Clear
            </Button>
            <Button variant="primary" onClick={handleSaveMemory} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Product thinking</p>
        <h2 className="text-lg font-semibold tracking-tight mt-1">What are we not seeing?</h2>
        <p className="text-xs text-sm-muted mt-2 leading-relaxed">
          Foydalanuvchi qachon chiqib ketadi? Qaysi friction drop beradi? Insightlar shu yerda.
        </p>

        <div className="mt-4 space-y-2">
          {insights.length === 0 && (
            <SoftCard className="p-4">
              <p className="text-sm text-sm-muted">No insights yet.</p>
            </SoftCard>
          )}
          {insights.map((insight, idx) => (
            <SoftCard key={`${insight.risk}-${idx}`} className="p-4">
              <p className="text-sm font-semibold tracking-tight">{insight.what_am_i_not_seeing}</p>
              <p className="text-xs text-sm-muted mt-2">Action: {insight.action}</p>
            </SoftCard>
          ))}
        </div>
      </Card>

      {shareCard && (
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Growth</p>
          <h2 className="text-lg font-semibold tracking-tight mt-1">Share card (preview)</h2>
          <p className="text-xs text-sm-muted mt-2 leading-relaxed">
            Screenshot qilib ulashing. Har share card ichida bitta real tip bo'lsin.
          </p>

          <SoftCard className="p-4 mt-4">
            <p className="text-sm font-semibold tracking-tight">{String(shareCard.title || 'Progress')}</p>
            <p className="text-sm mt-2 leading-relaxed">{String(shareCard.win_text || '')}</p>
            <p className="text-xs text-sm-muted mt-2 leading-relaxed">{String(shareCard.personal_tip || '')}</p>
          </SoftCard>

          <div className="mt-3">
            <Button variant="ghost" className="w-full" onClick={() => navigate('/practice')}>
              Prove it again
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
