/* ===========================
   ErrorList - Premium error cards with evidence-friendly layout
   =========================== */

import type { ReactNode } from 'react'
import type { DetectedError } from '../types'
import { SoftCard } from './ui/Card'

interface Props {
  errors: DetectedError[]
  maxItems?: number
}

const categoryMeta: Record<
  string,
  { label: string; gradient: string; chipBg: string }
> = {
  pronunciation: {
    label: 'Pronunciation',
    gradient: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy))',
    chipBg: 'bg-sm-card2',
  },
  grammar: {
    label: 'Grammar',
    gradient: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2))',
    chipBg: 'bg-sm-card2',
  },
  vocabulary: {
    label: 'Vocabulary',
    gradient: 'linear-gradient(90deg, var(--sm-energy-2), var(--sm-energy))',
    chipBg: 'bg-sm-card2',
  },
  fluency: {
    label: 'Fluency',
    gradient: 'linear-gradient(90deg, var(--sm-energy), var(--sm-accent))',
    chipBg: 'bg-sm-card2',
  },
}

function Chip({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight border border-sm-border ${className}`}
    >
      {children}
    </span>
  )
}

export default function ErrorList({ errors, maxItems }: Props) {
  const items = maxItems ? errors.slice(0, maxItems) : errors

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-sm-muted">Perfect. No errors detected.</p>
        <p className="text-xs text-sm-muted mt-2">
          Tip: try a longer answer (60-90s) so the coach can score you accurately.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((err, i) => {
        const meta = categoryMeta[err.category] || categoryMeta.grammar
        const original = (err.original_text || '').trim()
        const corrected = (err.corrected_text || '').trim()
        const explanation = (err.explanation || '').trim()

        return (
          <SoftCard
            key={i}
            className="rounded-2xl p-4 animate-fade-in"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip className={`${meta.chipBg}`}>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: meta.gradient }}
                    />
                    <span>{meta.label}</span>
                  </Chip>
                  {err.subcategory && (
                    <span className="text-[11px] text-sm-muted truncate">
                      {err.subcategory}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-sm-muted tabular-nums">
                {Math.round((err.confidence || 0) * 100)}%
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {original && (
                <div className="rounded-xl bg-sm-card2 border border-sm-border px-3 py-2">
                  <p className="text-[11px] text-sm-muted uppercase tracking-widest">
                    You said
                  </p>
                  <p className="text-sm mt-1 leading-snug">{original}</p>
                </div>
              )}

              {corrected && (
                <div className="rounded-xl border border-sm-border px-3 py-2">
                  <p className="text-[11px] text-sm-muted uppercase tracking-widest">
                    Try
                  </p>
                  <p className="text-sm mt-1 leading-snug font-medium">{corrected}</p>
                </div>
              )}
            </div>

            {explanation && (
              <p className="text-xs text-sm-muted mt-3 leading-relaxed">
                {explanation}
              </p>
            )}
          </SoftCard>
        )
      })}

      {maxItems && errors.length > maxItems && (
        <p className="text-center text-xs text-sm-muted">
          +{errors.length - maxItems} more errors in this session
        </p>
      )}
    </div>
  )
}
