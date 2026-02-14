/* ===========================
   CriterionSection — Reusable per-criterion detail view
   Shows: score + explanation, metrics, strengths, weaknesses, tips
   =========================== */

import { useState, type ReactNode } from 'react'
import { SoftCard } from '../ui/Card'
import type { CriterionFeedback, IELTSCriterionDetail } from '../../types'

interface Props {
  /** Criterion label, e.g. "Fluency & Coherence" */
  label: string
  /** Emoji/icon to show */
  icon: string
  /** Raw band score or detailed object */
  scoreData: number | IELTSCriterionDetail
  /** Per-criterion feedback from CriterionFeedbackGenerator */
  feedback?: CriterionFeedback
  /** Slot for <MetricsGrid /> */
  metricsSlot?: ReactNode
}

function bandColor(band: number): string {
  if (band >= 7) return 'text-green-400'
  if (band >= 6) return 'text-yellow-400'
  if (band >= 5) return 'text-orange-400'
  return 'text-red-400'
}

function bandBg(band: number): string {
  if (band >= 7) return 'bg-green-500/10 border-green-500/20'
  if (band >= 6) return 'bg-yellow-500/10 border-yellow-500/20'
  if (band >= 5) return 'bg-orange-500/10 border-orange-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

export default function CriterionSection({
  label,
  icon,
  scoreData,
  feedback,
  metricsSlot,
}: Props) {
  const band = typeof scoreData === 'number' ? scoreData : (scoreData?.band ?? 0)
  const descriptor = typeof scoreData === 'object' ? scoreData?.descriptor : undefined

  const [showAllTips, setShowAllTips] = useState(false)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score header */}
      <SoftCard className={`rounded-2xl p-4 border ${bandBg(band)}`}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{label}</p>
            {descriptor && (
              <p className="text-[11px] text-sm-muted mt-0.5 leading-relaxed">{descriptor}</p>
            )}
          </div>
          <div className={`text-2xl font-bold tabular-nums ${bandColor(band)}`}>
            {band.toFixed(1)}
          </div>
        </div>

        {/* Score explanation */}
        {feedback?.score_explanation && (
          <p className="text-sm text-sm-text mt-3 leading-relaxed">
            {feedback.score_explanation}
          </p>
        )}
      </SoftCard>

      {/* Metrics */}
      {metricsSlot && (
        <SoftCard className="rounded-2xl p-4">
          <SectionHeader title="Metrics" />
          {metricsSlot}
          {feedback?.metrics_summary && (
            <p className="text-[11px] text-sm-muted mt-3 italic">{feedback.metrics_summary}</p>
          )}
        </SoftCard>
      )}

      {/* Strengths */}
      {feedback && feedback.strengths.length > 0 && (
        <SoftCard className="rounded-2xl p-4">
          <SectionHeader title="What you did well" />
          <ul className="mt-2 space-y-2">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-green-400 shrink-0" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </SoftCard>
      )}

      {/* Weaknesses with examples */}
      {feedback && feedback.weaknesses.length > 0 && (
        <SoftCard className="rounded-2xl p-4">
          <SectionHeader title="Areas to improve" />
          <div className="mt-2 space-y-3">
            {feedback.weaknesses.map((w, i) => (
              <div
                key={i}
                className="rounded-xl bg-sm-card2 border border-sm-border p-3"
              >
                <p className="text-sm font-medium">{w.issue}</p>

                {w.example && (
                  <div className="mt-2 flex flex-col sm:flex-row gap-2 text-sm">
                    <div className="flex-1 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2">
                      <p className="text-[10px] text-sm-muted uppercase tracking-widest">You said</p>
                      <p className="mt-0.5 leading-snug">{w.example}</p>
                    </div>
                    {w.fix && (
                      <div className="flex-1 rounded-lg bg-green-500/5 border border-green-500/15 px-3 py-2">
                        <p className="text-[10px] text-sm-muted uppercase tracking-widest">Better</p>
                        <p className="mt-0.5 leading-snug font-medium">{w.fix}</p>
                      </div>
                    )}
                  </div>
                )}

                {w.rule && (
                  <p className="text-[11px] text-sm-muted mt-2 leading-relaxed">
                    <span className="font-medium">Rule:</span> {w.rule}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SoftCard>
      )}

      {/* Tips */}
      {feedback && feedback.tips.length > 0 && (
        <SoftCard className="rounded-2xl p-4">
          <SectionHeader title="Improvement tips" />
          <ol className="mt-2 space-y-2 list-decimal list-inside">
            {(showAllTips ? feedback.tips : feedback.tips.slice(0, 3)).map((tip, i) => (
              <li key={i} className="text-sm leading-relaxed pl-1">
                {tip}
              </li>
            ))}
          </ol>
          {feedback.tips.length > 3 && !showAllTips && (
            <button
              onClick={() => setShowAllTips(true)}
              className="text-sm-accent text-xs mt-2 hover:underline"
            >
              +{feedback.tips.length - 3} more tips
            </button>
          )}
        </SoftCard>
      )}

      {/* Empty state */}
      {!feedback && !metricsSlot && (
        <SoftCard className="rounded-2xl p-4">
          <p className="text-sm text-sm-muted text-center py-4">
            Detailed analysis is being generated. Check back in a moment.
          </p>
        </SoftCard>
      )}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">{title}</p>
  )
}
