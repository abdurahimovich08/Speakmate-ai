/* ===========================
   MetricsGrid — Visual computed-metrics display
   Shows WPM, TTR, filler density, sentence types, etc.
   =========================== */

import type { FluencyMetrics, LexicalMetrics, GrammarMetrics } from '../../types'

// ---- Shared metric card ----
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="sm-card-soft rounded-xl p-3 flex flex-col gap-0.5">
      <p className="text-[10px] text-sm-muted uppercase tracking-widest">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-sm-muted">{sub}</p>}
    </div>
  )
}

function MiniBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-sm-muted w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-sm-card2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums text-sm-muted w-10 text-right">{pct}%</span>
    </div>
  )
}

function Badge({ text }: { text: string }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded-full bg-sm-card2 border border-sm-border">
      {text}
    </span>
  )
}

// ---- Fluency ----
export function FluencyMetricsGrid({ m }: { m: FluencyMetrics }) {
  const wpm = m.word_count > 0 && m.sentence_count > 0
    ? Math.round((m.word_count / (m.sentence_count * m.avg_sentence_length)) * 120)
    : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Words" value={String(m.word_count)} />
        <Metric label="Sentences" value={String(m.sentence_count)} />
        <Metric
          label="Avg Length"
          value={`${m.avg_sentence_length} w`}
          sub="words/sentence"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric
          label="Discourse"
          value={String(m.discourse_markers)}
          sub="connectors"
        />
        <Metric
          label="Fillers"
          value={String(m.filler_count)}
          sub={`${(m.filler_density * 100).toFixed(1)}% density`}
        />
        <Metric
          label="Self-fix"
          value={String(m.self_correction_count)}
          sub="corrections"
        />
      </div>
      <MiniBar
        label="Filler rate"
        pct={Math.min(100, Math.round(m.filler_density * 1000))}
        color="var(--sm-energy-2)"
      />
    </div>
  )
}

// ---- Lexical ----
export function LexicalMetricsGrid({ m }: { m: LexicalMetrics }) {
  const advPct = Math.round(m.advanced_word_ratio * 100)
  const basicPct = Math.round(m.basic_word_ratio * 100)
  const ttrPct = Math.round(m.ttr * 100)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Total" value={String(m.word_count)} sub="words" />
        <Metric label="Unique" value={String(m.unique_word_count)} sub="words" />
        <Metric label="TTR" value={`${ttrPct}%`} sub="variety ratio" />
      </div>
      <div className="space-y-2">
        <MiniBar label="Advanced" pct={advPct} color="var(--sm-energy)" />
        <MiniBar label="Basic" pct={basicPct} color="var(--sm-accent)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Collocations" value={String(m.collocation_count)} />
        <Metric label="Idioms" value={String(m.idiom_count)} />
      </div>
      {m.advanced_words.length > 0 && (
        <div>
          <p className="text-[10px] text-sm-muted uppercase tracking-widest mb-1.5">
            Advanced words used
          </p>
          <div className="flex flex-wrap gap-1.5">
            {m.advanced_words.slice(0, 8).map((w) => (
              <Badge key={w} text={w} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Grammar ----
export function GrammarMetricsGrid({ m }: { m: GrammarMetrics }) {
  const total = m.simple_sentences + m.compound_sentences + m.complex_sentences || 1
  const simplePct = Math.round((m.simple_sentences / total) * 100)
  const compoundPct = Math.round((m.compound_sentences / total) * 100)
  const complexPct = Math.round((m.complex_sentences / total) * 100)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Simple" value={String(m.simple_sentences)} sub={`${simplePct}%`} />
        <Metric label="Compound" value={String(m.compound_sentences)} sub={`${compoundPct}%`} />
        <Metric label="Complex" value={String(m.complex_sentences)} sub={`${complexPct}%`} />
      </div>
      <div className="space-y-2">
        <MiniBar label="Simple" pct={simplePct} color="var(--sm-accent)" />
        <MiniBar label="Compound" pct={compoundPct} color="var(--sm-energy-2)" />
        <MiniBar label="Complex" pct={complexPct} color="var(--sm-energy)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Tenses" value={String(m.tense_variety)} sub="different" />
        <Metric
          label="Variety"
          value={`${Math.round(m.structure_variety_ratio * 100)}%`}
          sub="non-simple"
        />
      </div>
      {m.tenses_used.length > 0 && (
        <div>
          <p className="text-[10px] text-sm-muted uppercase tracking-widest mb-1.5">
            Tenses used
          </p>
          <div className="flex flex-wrap gap-1.5">
            {m.tenses_used.map((t) => (
              <Badge key={t} text={t.replace(/_/g, ' ')} />
            ))}
          </div>
        </div>
      )}
      {m.complex_features.length > 0 && (
        <div>
          <p className="text-[10px] text-sm-muted uppercase tracking-widest mb-1.5">
            Complex features
          </p>
          <div className="flex flex-wrap gap-1.5">
            {m.complex_features.map((f) => (
              <Badge key={f} text={f.replace(/_/g, ' ')} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
