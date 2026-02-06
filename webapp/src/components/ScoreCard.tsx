/* ===========================
   ScoreCard — Display IELTS band scores
   =========================== */

import type { IELTSScores } from '../types'

interface Props {
  scores: IELTSScores
  compact?: boolean
}

const categories = [
  { key: 'fluency_coherence', label: 'Fluency & Coherence', icon: '🗣' },
  { key: 'lexical_resource', label: 'Lexical Resource', icon: '📖' },
  { key: 'grammatical_range', label: 'Grammar', icon: '✏️' },
  { key: 'pronunciation', label: 'Pronunciation', icon: '🔊' },
] as const

function bandColor(band: number): string {
  if (band >= 7) return 'text-green-600'
  if (band >= 6) return 'text-yellow-600'
  if (band >= 5) return 'text-orange-500'
  return 'text-red-500'
}

export default function ScoreCard({ scores, compact }: Props) {
  return (
    <div className="bg-tg-section rounded-2xl p-4 animate-fade-in">
      {/* Overall band */}
      <div className="text-center mb-4">
        <p className="text-tg-subtitle text-sm">Overall Band</p>
        <p className={`text-5xl font-bold ${bandColor(scores.overall_band)}`}>
          {scores.overall_band.toFixed(1)}
        </p>
      </div>

      {/* Category scores */}
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          {categories.map(({ key, label, icon }) => {
            const val = scores[key]
            return (
              <div key={key} className="bg-tg-secondary rounded-xl p-3 text-center">
                <span className="text-lg">{icon}</span>
                <p className="text-xs text-tg-hint mt-1">{label}</p>
                <p className={`text-xl font-bold ${bandColor(val)}`}>
                  {val.toFixed(1)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
