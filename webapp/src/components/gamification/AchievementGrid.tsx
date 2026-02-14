/* AchievementGrid — 3-column grid of achievement badges */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Achievement } from '../../stores/gamificationStore'

interface Props {
  achievements: Achievement[]
}

const defaultAchievements: Achievement[] = [
  { id: 'first_steps', title: 'Birinchi qadam', description: 'Birinchi sessiyani yakunlang', icon: '👶', earned: false },
  { id: 'week_warrior', title: 'Hafta jangchisi', description: '7 kunlik streak', icon: '⚔️', earned: false },
  { id: 'century', title: 'Yuztalik', description: '100 ta sessiya', icon: '💯', earned: false },
  { id: 'band_breaker', title: 'Band buzar', description: 'Band ni 1.0+ ga oshiring', icon: '📈', earned: false },
  { id: 'perfectionist', title: 'Mukammalchi', description: '0 xatoli sessiya', icon: '✨', earned: false },
  { id: 'grammar_king', title: 'Grammatika qiroli', description: 'Grammar 7.0+', icon: '👑', earned: false },
  { id: 'vocab_master', title: 'So\'z ustasi', description: 'Lexical 7.0+', icon: '📚', earned: false },
  { id: 'speed_talker', title: 'Tez gapiruvchi', description: '150+ WPM yaxshi ball bilan', icon: '⚡', earned: false },
  { id: 'marathon', title: 'Marafon', description: '30 kunlik streak', icon: '🏅', earned: false },
  { id: 'target_reached', title: 'Maqsadga yetish', description: 'Target band ga yeting', icon: '🎯', earned: false },
]

export default function AchievementGrid({ achievements }: Props) {
  const [selected, setSelected] = useState<Achievement | null>(null)

  // Merge earned achievements with defaults
  const merged = defaultAchievements.map((def) => {
    const earned = achievements.find((a) => a.id === def.id)
    return earned ? { ...def, ...earned, earned: true } : def
  })

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {merged.map((a, i) => (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelected(a)}
            className={`flex flex-col items-center p-3 rounded-2xl border transition-colors ${
              a.earned
                ? 'border-sm-accent/20 bg-sm-accent/5'
                : 'border-sm-border bg-sm-card2 opacity-50 grayscale'
            }`}
          >
            <span className="text-2xl">{a.earned ? a.icon : '🔒'}</span>
            <p className="text-[10px] font-medium mt-1 text-center leading-tight">
              {a.title}
            </p>
          </motion.button>
        ))}
      </div>

      {/* Detail popup */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="sm-glass rounded-2xl p-6 max-w-xs w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-5xl block mb-3">
                {selected.earned ? selected.icon : '🔒'}
              </span>
              <p className="text-lg font-bold">{selected.title}</p>
              <p className="text-sm text-sm-muted mt-1">{selected.description}</p>
              {selected.earned && selected.earned_at && (
                <p className="text-xs text-sm-accent mt-2">
                  {new Date(selected.earned_at).toLocaleDateString('uz')} da qo'lga kiritilgan
                </p>
              )}
              {!selected.earned && (
                <p className="text-xs text-sm-muted mt-2 italic">Hali qo'lga kiritilmagan</p>
              )}
              <button
                onClick={() => setSelected(null)}
                className="mt-4 sm-btn bg-sm-card2 text-sm-text px-6 py-2"
              >
                Yopish
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
