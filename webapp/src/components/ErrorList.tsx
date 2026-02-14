/* ===========================
   ErrorList - Enhanced error cards with rules, impact, and grouping
   =========================== */

import { useState, type ReactNode } from 'react'
import type { DetectedError } from '../types'
import { SoftCard } from './ui/Card'

interface Props {
  errors: DetectedError[]
  maxItems?: number
}

const categoryMeta: Record<
  string,
  { label: string; gradient: string; chipBg: string; emoji: string }
> = {
  pronunciation: {
    label: 'Pronunciation',
    gradient: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy))',
    chipBg: 'bg-sm-card2',
    emoji: '🎙',
  },
  grammar: {
    label: 'Grammar',
    gradient: 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2))',
    chipBg: 'bg-sm-card2',
    emoji: '✍️',
  },
  vocabulary: {
    label: 'Vocabulary',
    gradient: 'linear-gradient(90deg, var(--sm-energy-2), var(--sm-energy))',
    chipBg: 'bg-sm-card2',
    emoji: '📖',
  },
  fluency: {
    label: 'Fluency',
    gradient: 'linear-gradient(90deg, var(--sm-energy), var(--sm-accent))',
    chipBg: 'bg-sm-card2',
    emoji: '🗣',
  },
}

const severityMeta: Record<string, { label: string; color: string; impact: string }> = {
  major: { label: 'Major', color: 'bg-red-500/20 text-red-300', impact: 'High impact on score' },
  moderate: {
    label: 'Moderate',
    color: 'bg-yellow-500/20 text-yellow-300',
    impact: 'Moderate impact',
  },
  minor: { label: 'Minor', color: 'bg-blue-500/20 text-blue-300', impact: 'Low impact' },
}

function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight border border-sm-border ${className}`}
    >
      {children}
    </span>
  )
}

export default function ErrorList({ errors, maxItems }: Props) {
  const [groupByCategory, setGroupByCategory] = useState(true)

  if (errors.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-sm-muted">Perfect. No errors detected.</p>
        <p className="text-xs text-sm-muted mt-2">
          Tip: try a longer answer (60-90s) so the coach can score you accurately.
        </p>
      </div>
    )
  }

  // Group errors by category
  const grouped: Record<string, DetectedError[]> = {}
  for (const err of errors) {
    const cat = err.category || 'grammar'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(err)
  }

  const items = maxItems ? errors.slice(0, maxItems) : errors

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(grouped).map(([cat, catErrors]) => {
          const meta = categoryMeta[cat] || categoryMeta.grammar
          return (
            <div
              key={cat}
              className="flex items-center gap-1.5 rounded-full bg-sm-card2 border border-sm-border px-2.5 py-1"
            >
              <span className="text-xs">{meta.emoji}</span>
              <span className="text-[11px] font-medium">{meta.label}</span>
              <span className="text-[11px] text-sm-muted tabular-nums">{catErrors.length}</span>
            </div>
          )
        })}

        {/* Toggle */}
        <button
          onClick={() => setGroupByCategory(!groupByCategory)}
          className="ml-auto text-[11px] text-sm-accent hover:underline"
        >
          {groupByCategory ? 'Show all' : 'Group by type'}
        </button>
      </div>

      {/* Grouped view */}
      {groupByCategory ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catErrors]) => {
            const meta = categoryMeta[cat] || categoryMeta.grammar
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{meta.emoji}</span>
                  <p className="text-xs font-medium uppercase tracking-wider">{meta.label}</p>
                  <span className="text-[11px] text-sm-muted">({catErrors.length})</span>
                </div>
                <div className="space-y-3">
                  {catErrors.map((err, i) => (
                    <ErrorCard key={`${cat}-${i}`} err={err} index={i} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((err, i) => (
            <ErrorCard key={i} err={err} index={i} />
          ))}
        </div>
      )}

      {maxItems && errors.length > maxItems && (
        <p className="text-center text-xs text-sm-muted">
          +{errors.length - maxItems} more errors in this session
        </p>
      )}
    </div>
  )
}

function ErrorCard({ err, index }: { err: DetectedError; index: number }) {
  const meta = categoryMeta[err.category] || categoryMeta.grammar
  const severity = severityMeta[(err as unknown as Record<string, string>).severity] || severityMeta.minor
  const original = (err.original_text || '').trim()
  const corrected = (err.corrected_text || '').trim()
  const explanation = (err.explanation || '').trim()
  const subcategory = (err.subcategory || '').trim()
  const errorCode = ((err as unknown as Record<string, string>).error_code || '').trim()

  return (
    <SoftCard
      className="rounded-2xl p-4 animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Top row: category + severity + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <Chip className={meta.chipBg}>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: meta.gradient }}
            />
            <span>{meta.label}</span>
          </Chip>
          {severity && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${severity.color}`}>
              {severity.label}
            </span>
          )}
          {subcategory && (
            <span className="text-[11px] text-sm-muted truncate">{subcategory}</span>
          )}
        </div>
        <div className="text-[11px] text-sm-muted tabular-nums shrink-0">
          {Math.round((err.confidence || 0) * 100)}%
        </div>
      </div>

      {/* Error code badge */}
      {errorCode && (
        <div className="mt-2">
          <span className="text-[10px] font-mono text-sm-muted bg-sm-card2 rounded px-1.5 py-0.5 border border-sm-border">
            {errorCode}
          </span>
        </div>
      )}

      {/* Original / Corrected comparison */}
      <div className="mt-3 grid gap-2">
        {original && (
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-3 py-2">
            <p className="text-[10px] text-sm-muted uppercase tracking-widest">You said</p>
            <p className="text-sm mt-1 leading-snug">{original}</p>
          </div>
        )}

        {corrected && (
          <div className="rounded-xl bg-green-500/5 border border-green-500/15 px-3 py-2">
            <p className="text-[10px] text-sm-muted uppercase tracking-widest">Correct</p>
            <p className="text-sm mt-1 leading-snug font-medium">{corrected}</p>
          </div>
        )}
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="mt-3 rounded-xl bg-sm-card2 border border-sm-border px-3 py-2">
          <p className="text-[10px] text-sm-muted uppercase tracking-widest">Why</p>
          <p className="text-xs mt-1 leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* Impact indicator */}
      {severity && (
        <p className="text-[10px] text-sm-muted mt-2 italic">{severity.impact}</p>
      )}
    </SoftCard>
  )
}
