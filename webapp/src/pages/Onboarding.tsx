/* ===========================
   Onboarding — 4-screen animated onboarding flow
   =========================== */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/Button'

const bandScale = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [targetBand, setTargetBand] = useState(6.5)
  const navigate = useNavigate()

  const finish = () => {
    localStorage.setItem('sm_onboarding_done', '1')
    localStorage.setItem('sm_target_band', String(targetBand))
    navigate('/', { replace: true })
  }

  const next = () => {
    if (step < 3) setStep(step + 1)
    else finish()
  }

  const slideVariants = {
    enter: { x: 80, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -80, opacity: 0 },
  }

  return (
    <div className="min-h-screen bg-sm-bg text-sm-text font-ui flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8 pb-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="h-2 rounded-full"
            animate={{
              width: i === step ? 24 : 8,
              backgroundColor: i <= step ? 'var(--sm-accent)' : 'var(--sm-card-2)',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="w-full max-w-sm"
          >
            {step === 0 && <WelcomeScreen />}
            {step === 1 && (
              <GoalScreen targetBand={targetBand} onSelect={setTargetBand} />
            )}
            {step === 2 && <StreakScreen />}
            {step === 3 && <StartScreen />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action */}
      <div className="px-6 pb-10 pt-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full animate-breathe"
          onClick={next}
        >
          {step === 3 ? 'Boshlash!' : 'Davom etish'}
        </Button>
        {step < 3 && (
          <button
            onClick={finish}
            className="block mx-auto mt-3 text-sm text-sm-muted"
          >
            O'tkazib yuborish
          </button>
        )}
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="text-center">
      {/* Animated speech bubbles */}
      <div className="relative h-40 flex items-center justify-center mb-6">
        <motion.div
          className="absolute w-20 h-20 rounded-full bg-sm-accent/20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-32 h-32 rounded-full bg-sm-accent/10"
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        />
        <div className="relative text-5xl">🎙️</div>
      </div>
      <h1 className="text-2xl font-bold font-display">
        Ingliz tilida erkin gaplashing
      </h1>
      <p className="text-sm text-sm-muted mt-3 leading-relaxed">
        SpeakMate AI — sizning shaxsiy IELTS coachingiz. Real vaqtda gaplashing,
        xatolarni toping, va band balingizni oshiring.
      </p>
    </div>
  )
}

function GoalScreen({
  targetBand,
  onSelect,
}: {
  targetBand: number
  onSelect: (band: number) => void
}) {
  const stepsToGoal = Math.max(1, Math.round((targetBand - 4.0) / 0.5))
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">🎯</div>
      <h2 className="text-xl font-bold font-display">Maqsadingiz nima?</h2>
      <p className="text-sm text-sm-muted mt-2">
        IELTS target bandingizni tanlang
      </p>

      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {bandScale.map((b) => (
          <motion.button
            key={b}
            whileTap={{ scale: 0.92 }}
            onClick={() => onSelect(b)}
            className={`w-12 h-12 rounded-xl text-sm font-bold border transition-colors ${
              targetBand === b
                ? 'bg-tg-button text-tg-button-text border-transparent'
                : 'bg-sm-card2 text-sm-text border-sm-border'
            }`}
          >
            {b.toFixed(1)}
          </motion.button>
        ))}
      </div>

      <motion.p
        key={targetBand}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-sm-accent font-medium mt-5"
      >
        Siz allaqachon yo'ldasiz! Maqsadga faqat {stepsToGoal} qadam!
      </motion.p>
    </div>
  )
}

function StreakScreen() {
  const days = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">🔥</div>
      <h2 className="text-xl font-bold font-display">Kundalik mashq</h2>
      <p className="text-sm text-sm-muted mt-2 leading-relaxed">
        Kuniga 10 daqiqa yetarli. Har kuni mashq qiling — natijani 7 kunda
        ko'rasiz.
      </p>

      <div className="flex justify-center gap-2 mt-6">
        {days.map((d, i) => (
          <motion.div
            key={d}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
              i < 5
                ? 'bg-sm-energy/20 text-sm-energy'
                : 'bg-sm-card2 text-sm-muted'
            }`}
          >
            {i < 5 ? '✓' : d}
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-sm-muted mt-4">
        5 kunlik streak = 250 XP bonus! 🎉
      </p>
    </div>
  )
}

function StartScreen() {
  return (
    <div className="text-center">
      <motion.div
        className="text-6xl mb-4"
        animate={{ rotate: [0, -5, 5, -5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
      >
        🚀
      </motion.div>
      <h2 className="text-xl font-bold font-display">Tayyor!</h2>
      <p className="text-sm text-sm-muted mt-2 leading-relaxed">
        Birinchi sessiyangizni boshlang. AI coach sizni real vaqtda
        yo'naltiradi, xatolarni tuzatadi va band balingizni hisoblaydi.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 bg-sm-card2 rounded-xl px-4 py-2">
        <span className="text-sm">🎙️</span>
        <span className="text-xs text-sm-muted">Gapiring → Coach tekshiradi → Band balingiz chiqadi</span>
      </div>
    </div>
  )
}
