/* ===========================
   ScoreCard - Premium IELTS score presentation
   Shows 4 criteria with band, descriptor, and error count
   =========================== */

import type { IELTSScores, IELTSCriterionDetail } from '../types'
import { ScoreRing } from './ui/ScoreRing'

interface Props {
  scores: IELTSScores
  compact?: boolean
}

const categories = [
  { key: 'fluency_coherence' as const, label: 'Fluency & Coherence', icon: '🗣' },
  { key: 'lexical_resource' as const, label: 'Lexical Resource', icon: '📖' },
  { key: 'grammatical_range' as const, label: 'Grammar', icon: '✍️' },
  { key: 'pronunciation' as const, label: 'Pronunciation', icon: '🎙' },
]

function getBand(val: number | IELTSCriterionDetail): number {
  if (typeof val === 'number') return val
  return val?.band ?? 0
}

function getDescriptor(val: number | IELTSCriterionDetail): string | undefined {
  if (typeof val === 'object' && val?.descriptor) return val.descriptor
  return undefined
}

function getErrorCount(val: number | IELTSCriterionDetail): number | undefined {
  if (typeof val === 'object' && val?.error_count != null) return val.error_count
  return undefined
}

function toPct(band: number): number {
  const v = Number.isFinite(band) ? Math.max(0, Math.min(9, band)) : 0
  return Math.round((v / 9) * 100)
}

function bandColor(band: number): string {
  if (band >= 7) return 'text-green-400'
  if (band >= 6) return 'text-yellow-400'
  if (band >= 5) return 'text-orange-400'
  return 'text-red-400'
}

export default function ScoreCard({ scores, compact }: Props) {
  return (
    <div className="sm-card p-4 animate-fade-in overflow-hidden relative">
      <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-sm-accent via-transparent to-sm-energy" />

      <div className="relative">
        <div className="flex items-center gap-4">
          <ScoreRing value={scores.overall_band} label="Overall band" size={compact ? 104 : 128} />
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="sm-card-soft rounded-xl p-3">
                <p className="text-[11px] text-sm-muted uppercase tracking-widest">Words</p>
                <p className="text-lg font-semibold mt-1 tabular-nums">{scores.word_count ?? '-'}</p>
              </div>
              <div className="sm-card-soft rounded-xl p-3">
                <p className="text-[11px] text-sm-muted uppercase tracking-widest">Errors</p>
                <p className="text-lg font-semibold mt-1 tabular-nums">{scores.total_errors ?? '-'}</p>
              </div>
            </div>
            {scores.summary && (
              <p className="text-xs text-sm-muted mt-3 leading-relaxed line-clamp-2">
                {scores.summary}
              </p>
            )}
            {!scores.summary && (
              <p className="text-xs text-sm-muted mt-3">
                Aim: consistency. 10-15 minutes daily beats a long session once a week.
              </p>
            )}
          </div>
        </div>

        {!compact && (
          <div className="mt-4 space-y-3">
            {categories.map(({ key, label, icon }) => {
              const raw = scores[key]
              const band = getBand(raw)
              const descriptor = getDescriptor(raw)
              const errorCount = getErrorCount(raw)
              const pct = toPct(band)

              return (
                <div key={key} className="sm-card-soft rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium tracking-tight">
                      <span className="mr-1.5">{icon}</span>
                      {label}
                    </p>
                    <div className="flex items-center gap-2">
                      {errorCount != null && errorCount > 0 && (
                        <span className="text-[10px] text-sm-muted bg-sm-card2 px-1.5 py-0.5 rounded-full">
                          {errorCount} errors
                        </span>
                      )}
                      <p className={`text-sm font-semibold tabular-nums ${bandColor(band)}`}>
                        {band.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-sm-card2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background:
                          'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))',
                      }}
                    />
                  </div>
                  {descriptor && (
                    <p className="text-[11px] text-sm-muted mt-2 leading-relaxed">
                      {descriptor}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
