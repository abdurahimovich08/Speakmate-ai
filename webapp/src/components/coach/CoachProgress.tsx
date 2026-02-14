/* ===========================
   CoachProgress — Progress proof dashboard
   =========================== */

import { Card, SoftCard } from '../ui/Card'
import type { ProgressProof } from '../../types'

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function pct(n: number) {
  return `${Math.round(clamp01(n) * 100)}%`
}

interface Props {
  proof: ProgressProof
}

export default function CoachProgress({ proof }: Props) {
  return (
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
          <SoftCard className="p-3">Band Δ: <b>{proof.deltas.band_delta}</b></SoftCard>
          <SoftCard className="p-3">Filler Δ: <b>{proof.deltas.filler_rate_delta}%</b></SoftCard>
          <SoftCard className="p-3">WPM Δ: <b>{proof.deltas.wpm_delta}</b></SoftCard>
          <SoftCard className="p-3">Grammar Δ: <b>{proof.deltas.grammar_accuracy_delta}</b></SoftCard>
        </div>
      )}

      {proof.highlights?.length ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Highlights</p>
          <ul className="mt-2 space-y-2 text-sm">
            {proof.highlights.slice(0, 3).map((h) => (
              <li key={h} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-accent" aria-hidden="true" />
                <span className="leading-relaxed">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
