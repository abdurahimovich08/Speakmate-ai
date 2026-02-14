/* SessionCelebration — Full-screen celebration after session ends */

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import AnimatedNumber from './AnimatedNumber'

interface Props {
  band: number
  xpEarned: number
  streak: number
  leveledUp: boolean
  levelName: string
  onContinue: () => void
}

const motivationalMessages = [
  'Ajoyib natija! Har bir sessiya sizni maqsadga yaqinlashtiradi.',
  'Zo\'r! Sizning rivojlanishingiz ko\'rinyapti!',
  'Yana bir qadam oldinga! Davom eting!',
  'Mashq — kuchning kaliti. Siz kuchayapsiz!',
  'Band balingiz oshmoqda. Siz to\'g\'ri yo\'ldasiz!',
  'Har bir sessiya — yangi imkoniyat. Ajoyib!',
  'Natijalaringiz ajoyib! Coach sizdan mamnun.',
  'Bugungi mashq ertangi muvaffaqiyat!',
  'Siz rivojlanayapsiz! Buning isboti — bu natija.',
  'Ajoyib ish! Keyingi sessiyada yanada yaxshiroq bo\'ladi.',
]

function randomMessage() {
  return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]
}

export default function SessionCelebration({
  band,
  xpEarned,
  streak,
  leveledUp,
  levelName,
  onContinue,
}: Props) {
  const [showDetails, setShowDetails] = useState(false)
  const message = useMemo(randomMessage, [])

  useEffect(() => {
    const t = setTimeout(() => setShowDetails(true), 1500)
    return () => clearTimeout(t)
  }, [])

  // Auto-continue after 6 seconds
  useEffect(() => {
    const t = setTimeout(onContinue, 8000)
    return () => clearTimeout(t)
  }, [onContinue])

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-sm-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(36,129,204,0.15), transparent 60%), radial-gradient(circle at 50% 70%, rgba(34,197,94,0.1), transparent 60%)',
        }}
      />

      {/* Confetti */}
      <Confetti />

      {/* Score ring */}
      <div className="relative z-10 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
          className="relative inline-flex items-center justify-center w-32 h-32 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, var(--sm-accent), var(--sm-energy), var(--sm-energy-2), var(--sm-accent))',
          }}
        >
          <div className="w-28 h-28 rounded-full bg-sm-bg flex items-center justify-center">
            <div className="text-center">
              <AnimatedNumber
                value={band}
                duration={1200}
                className="text-4xl font-bold font-display"
              />
              <p className="text-[10px] text-sm-muted uppercase tracking-widest mt-0.5">BAND</p>
            </div>
          </div>
        </motion.div>

        {/* XP + Streak */}
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 space-y-3"
          >
            {/* XP */}
            <div className="flex items-center justify-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="flex items-center gap-2 bg-sm-energy/10 px-4 py-2 rounded-xl"
              >
                <span className="text-lg">⚡</span>
                <span className="text-sm font-bold text-sm-energy">+{xpEarned} XP</span>
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="flex items-center gap-2 bg-orange-500/10 px-4 py-2 rounded-xl"
              >
                <span className="text-lg">🔥</span>
                <span className="text-sm font-bold text-orange-400">{streak} kun</span>
              </motion.div>
            </div>

            {/* Level up */}
            {leveledUp && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.4 }}
                className="bg-sm-accent/10 px-4 py-3 rounded-xl"
              >
                <p className="text-sm font-bold text-sm-accent">🎉 Yangi daraja: {levelName}!</p>
              </motion.div>
            )}

            {/* Motivational message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm text-sm-muted px-4 leading-relaxed"
            >
              {message}
            </motion.p>
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          onClick={onContinue}
          className="mt-8 sm-btn bg-tg-button text-tg-button-text px-8 py-3"
        >
          Natijalarni ko'rish →
        </motion.button>
      </div>
    </motion.div>
  )
}

function Confetti() {
  const colors = ['#2481cc', '#22c55e', '#f97316', '#ffffff', '#a855f7', '#eab308']

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.5}s`,
        duration: `${2 + Math.random() * 1.5}s`,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
      })),
    [],
  )

  return (
    <div className="confetti-container">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}
