/* ===========================
   CoachInsights — Behavior insights & share card
   =========================== */

import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Card, SoftCard } from '../ui/Card'
import type { BehaviorInsight } from '../../types'

interface Props {
  insights: BehaviorInsight[]
  shareCard: Record<string, unknown> | null
}

export default function CoachInsights({ insights, shareCard }: Props) {
  const navigate = useNavigate()

  return (
    <>
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
    </>
  )
}
