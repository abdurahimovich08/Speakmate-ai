/* ===========================
   ScoreCard - Premium IELTS score presentation
   =========================== */

import type { IELTSScores } from '../types'
import { ScoreRing } from './ui/ScoreRing'

interface Props {
  scores: IELTSScores
  compact?: boolean
}

const categories = [
  { key: 'fluency_coherence', label: 'Fluency & Coherence' },
  { key: 'lexical_resource', label: 'Lexical Resource' },
  { key: 'grammatical_range', label: 'Grammar' },
  { key: 'pronunciation', label: 'Pronunciation' },
] as const

function toPct(band: number): number {
  const v = Number.isFinite(band) ? Math.max(0, Math.min(9, band)) : 0
  return Math.round((v / 9) * 100)
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
            <p className="text-xs text-sm-muted mt-3">
              Aim: consistency. 10-15 minutes daily beats a long session once a week.
            </p>
          </div>
        </div>

        {!compact && (
          <div className="mt-4 space-y-3">
            {categories.map(({ key, label }) => {
              const val = scores[key]
              const pct = toPct(val)
              return (
                <div key={key} className="sm-card-soft rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium tracking-tight">{label}</p>
                    <p className="text-sm font-semibold tabular-nums">{val.toFixed(1)}</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-sm-card2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

