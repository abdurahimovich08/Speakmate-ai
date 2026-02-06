/* ===========================
   ErrorList — Show detected errors with corrections
   =========================== */

import type { DetectedError } from '../types'

interface Props {
  errors: DetectedError[]
  maxItems?: number
}

const categoryStyles: Record<string, { icon: string; color: string }> = {
  pronunciation: { icon: '🔊', color: 'bg-purple-100 text-purple-800' },
  grammar: { icon: '✏️', color: 'bg-blue-100 text-blue-800' },
  vocabulary: { icon: '📖', color: 'bg-green-100 text-green-800' },
  fluency: { icon: '🗣', color: 'bg-orange-100 text-orange-800' },
}

export default function ErrorList({ errors, maxItems }: Props) {
  const items = maxItems ? errors.slice(0, maxItems) : errors

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-tg-hint">
        <p className="text-3xl mb-2">🎉</p>
        <p>Xatolar topilmadi!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((err, i) => {
        const style = categoryStyles[err.category] || categoryStyles.grammar
        return (
          <div
            key={i}
            className="bg-tg-section rounded-xl p-3 animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${style.color}`}
              >
                {style.icon} {err.category}
              </span>
              <span className="text-xs text-tg-hint">{err.subcategory}</span>
            </div>

            <p className="text-sm">
              <span className="line-through text-red-500">{err.original_text}</span>
              {' → '}
              <span className="text-green-600 font-medium">{err.corrected_text}</span>
            </p>

            <p className="text-xs text-tg-hint mt-1">{err.explanation}</p>
          </div>
        )
      })}

      {maxItems && errors.length > maxItems && (
        <p className="text-center text-xs text-tg-hint">
          +{errors.length - maxItems} ta yana xato
        </p>
      )}
    </div>
  )
}
