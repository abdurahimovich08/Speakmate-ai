/* ===========================
   OverviewTab — Top-level session overview
   ScoreCard + 4 criterion mini-cards + strengths + corrected sample
   =========================== */

import ScoreCard from '../ScoreCard'
import { SoftCard } from '../ui/Card'
import type {
  IELTSScores,
  IELTSCriterionDetail,
  Recommendation,
  FullCriterionFeedback,
  TrainingPlan,
} from '../../types'

interface Props {
  scores: IELTSScores
  criterionFeedback: FullCriterionFeedback | null
  recommendations: Recommendation[]
  summary: string
  trainingPlan: TrainingPlan | null
  onTabChange: (tab: string) => void
}

function getBand(val: number | IELTSCriterionDetail): number {
  if (typeof val === 'number') return val
  return val?.band ?? 0
}

function bandColor(band: number): string {
  if (band >= 7) return 'border-green-500/30 bg-green-500/10'
  if (band >= 6) return 'border-yellow-500/30 bg-yellow-500/10'
  if (band >= 5) return 'border-orange-500/30 bg-orange-500/10'
  return 'border-red-500/30 bg-red-500/10'
}

function bandTextColor(band: number): string {
  if (band >= 7) return 'text-green-400'
  if (band >= 6) return 'text-yellow-400'
  if (band >= 5) return 'text-orange-400'
  return 'text-red-400'
}

const criteriaConfig = [
  { key: 'fluency_coherence' as const, label: 'Fluency', icon: '🗣', tab: 'fluency' },
  { key: 'lexical_resource' as const, label: 'Vocabulary', icon: '📖', tab: 'vocabulary' },
  { key: 'grammatical_range' as const, label: 'Grammar', icon: '✍️', tab: 'grammar' },
  { key: 'pronunciation' as const, label: 'Pronunciation', icon: '🎙', tab: 'pronunciation' },
]

export default function OverviewTab({
  scores,
  criterionFeedback,
  recommendations,
  summary,
  trainingPlan,
  onTabChange,
}: Props) {
  const feedback = criterionFeedback
  const overallStrengths = feedback?.overall_strengths || []
  const correctedSample = feedback?.corrected_sample || ''

  return (
    <div className="space-y-4">
      {/* Overall score ring */}
      <ScoreCard scores={scores} compact />

      {/* 4 criterion mini-cards */}
      <div className="grid grid-cols-2 gap-2">
        {criteriaConfig.map(({ key, label, icon, tab }) => {
          const band = getBand(scores[key])
          const sectionFeedback = feedback?.[key]
          const explanation = sectionFeedback?.score_explanation || ''

          return (
            <button
              key={key}
              onClick={() => onTabChange(tab)}
              className={`text-left rounded-2xl border p-3 transition-all active:scale-[0.97] ${bandColor(band)}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{icon}</span>
                <span className={`text-lg font-bold tabular-nums ${bandTextColor(band)}`}>
                  {band.toFixed(1)}
                </span>
              </div>
              <p className="text-xs font-medium mt-1">{label}</p>
              {explanation && (
                <p className="text-[10px] text-sm-muted mt-1 leading-relaxed line-clamp-2">
                  {explanation}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* Overall strengths */}
      {overallStrengths.length > 0 && (
        <SoftCard className="rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
            What you did well
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {overallStrengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-green-400 shrink-0" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </SoftCard>
      )}

      {/* Corrected speech sample */}
      {correctedSample && (
        <SoftCard className="rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
            How it could sound at Band 7+
          </p>
          <p className="text-sm mt-3 leading-relaxed italic text-sm-text">
            "{correctedSample}"
          </p>
        </SoftCard>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <SoftCard className="rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
            Next steps
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {recommendations.slice(0, 5).map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-sm-accent shrink-0" />
                <div className="leading-relaxed">
                  {typeof rec === 'string' ? (
                    rec
                  ) : (
                    <>
                      {rec.area && <span className="font-medium">{rec.area}: </span>}
                      {rec.recommendation}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {summary && (
            <p className="text-xs text-sm-muted mt-3 leading-relaxed">{summary}</p>
          )}
        </SoftCard>
      )}

      {/* Training Plan (brief) */}
      {trainingPlan && trainingPlan.daily_tasks && trainingPlan.daily_tasks.length > 0 && (
        <SoftCard className="rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">
            7-day training plan
          </p>
          {trainingPlan.focus_areas && trainingPlan.focus_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
              {trainingPlan.focus_areas.map((area, i) => (
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
            {trainingPlan.daily_tasks.slice(0, 3).map((day) => (
              <div key={day.day} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-sm-muted font-medium w-9 shrink-0 pt-0.5">
                  Day {day.day}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{day.focus}</p>
                  <p className="text-xs text-sm-muted mt-0.5">
                    {day.tasks.join(' · ')}
                  </p>
                </div>
                <span className="text-[10px] text-sm-muted shrink-0">{day.estimated_minutes}m</span>
              </div>
            ))}
            {trainingPlan.daily_tasks.length > 3 && (
              <p className="text-xs text-sm-muted text-center">
                +{trainingPlan.daily_tasks.length - 3} more days
              </p>
            )}
          </div>
        </SoftCard>
      )}
    </div>
  )
}
