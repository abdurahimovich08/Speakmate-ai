/* ===========================
   CoachDrills — Mnemonic drill cards
   =========================== */

import { Card, SoftCard } from '../ui/Card'
import type { MnemonicDrill } from '../../types'

interface Props {
  drills: MnemonicDrill[]
  onFeedback: (drill: MnemonicDrill, score: number) => void
}

export default function CoachDrills({ drills, onFeedback }: Props) {
  return (
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
              <div className="shrink-0 text-[11px] text-sm-muted">{drill.category}</div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Rate helpfulness">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() => onFeedback(drill, score)}
                  className="py-2 rounded-xl text-xs font-semibold bg-sm-card2 border border-sm-border text-sm-text active:scale-[0.98] transition-transform"
                  aria-label={`Rate ${score} out of 5`}
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
  )
}
