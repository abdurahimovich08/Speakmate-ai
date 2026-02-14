/* ===========================
   CoachSkillGraph — Skill heatmap / graph
   =========================== */

import { Card, SoftCard } from '../ui/Card'
import type { SkillGraph } from '../../types'

interface Props {
  skillGraph: SkillGraph
}

export default function CoachSkillGraph({ skillGraph }: Props) {
  return (
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
                <div className="mt-2 h-2 rounded-full bg-sm-card2 overflow-hidden" role="progressbar" aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={9}>
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
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sm-energy" aria-hidden="true" />
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
