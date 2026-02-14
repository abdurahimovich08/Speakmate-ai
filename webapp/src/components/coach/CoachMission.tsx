/* ===========================
   CoachMission — Daily mission card
   =========================== */

import { telegramService } from '../../services/telegram'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { DailyMission } from '../../types'

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function pct(n: number) {
  return `${Math.round(clamp01(n) * 100)}%`
}

interface Props {
  mission: DailyMission
  completed: string[]
  saving: boolean
  onToggleTask: (taskId: string) => void
  onMarkAll: () => void
  onComplete: () => void
}

export default function CoachMission({ mission, completed, saving, onToggleTask, onMarkAll, onComplete }: Props) {
  const completion = clamp01(completed.length / Math.max(1, mission.tasks.length))

  return (
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
            {pct(completion)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2" role="list" aria-label="Mission tasks">
        {mission.tasks.map((task) => {
          const done = completed.includes(task.id)
          return (
            <button
              key={task.id}
              onClick={() => onToggleTask(task.id)}
              className="w-full text-left sm-card-soft rounded-2xl p-4 transition-transform active:scale-[0.985]"
              role="listitem"
              aria-pressed={done}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-xl border border-sm-border ${
                    done ? 'bg-tg-button text-tg-button-text' : 'bg-sm-card2 text-sm-muted'
                  }`}
                  aria-hidden="true"
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
        <Button variant="ghost" onClick={onMarkAll}>
          Mark all
        </Button>
        <Button
          variant="primary"
          disabled={saving || completed.length === 0}
          onClick={onComplete}
        >
          {saving ? 'Saving...' : 'Complete'}
        </Button>
      </div>
    </Card>
  )
}
