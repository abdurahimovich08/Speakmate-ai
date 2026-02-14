/* ===========================
   Practice - Premium setup with animated mode cards + topic chips
   =========================== */

import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSessionStore } from '../stores/sessionStore'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { telegramService } from '../services/telegram'
import { Button } from '../components/ui/Button'
import { Card, SoftCard } from '../components/ui/Card'
import type { SessionMode } from '../types'

const modes: Array<{
  id: SessionMode
  title: string
  desc: string
  vibe: string
  icon: string
}> = [
  {
    id: 'free_speaking',
    title: 'Free Speaking',
    desc: 'Real conversation. Fast feedback.',
    vibe: 'ENERGY',
    icon: '🎙️',
  },
  {
    id: 'ielts_test',
    title: 'IELTS Mock',
    desc: 'Exam-style prompts + scoring.',
    vibe: 'FOCUS',
    icon: '📝',
  },
  {
    id: 'training',
    title: 'Training',
    desc: 'Fix recurring mistakes with drills.',
    vibe: 'BUILD',
    icon: '🏋️',
  },
]

const topics: Record<SessionMode, string[]> = {
  free_speaking: [
    'Work',
    'Education',
    'Travel',
    'Technology',
    'Family',
    'Food',
    'Health',
    'Goals',
    'Weekend',
    'Surprise me',
  ],
  ielts_test: ['Part 1', 'Part 2', 'Part 3', 'Full test'],
  training: ['Grammar', 'Pronunciation', 'Vocabulary', 'Fluency'],
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function Practice() {
  const [searchParams] = useSearchParams()
  const preMode = searchParams.get('mode') as SessionMode | null
  const [selectedMode, setSelectedMode] = useState<SessionMode>(preMode || 'free_speaking')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const startSession = useSessionStore((s) => s.startSession)
  useTelegramBackButton(true)

  const topicList = useMemo(() => topics[selectedMode] || [], [selectedMode])

  const handleStart = useCallback(async () => {
    setLoading(true)
    telegramService.hapticImpact('medium')
    try {
      const topic = selectedTopic === 'Surprise me' ? undefined : selectedTopic || undefined
      await startSession(selectedMode, topic)
      navigate('/session/active')
    } catch (e) {
      console.error('Failed to start session:', e)
      telegramService.hapticNotification('error')
      await telegramService.alert("Sessiyani boshlashda xatolik. Qaytadan urinib ko'ring.")
    } finally {
      setLoading(false)
    }
  }, [selectedMode, selectedTopic, startSession, navigate])

  return (
    <motion.div
      className="p-4 font-ui"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <Card className="p-4 mb-4 overflow-hidden relative">
          <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-sm-energy2 via-transparent to-sm-accent" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Warm up</p>
            <h1 className="text-2xl font-semibold font-display mt-1">Start a session</h1>
            <p className="text-xs text-sm-muted mt-2">
              Choose mode, pick a topic, then go. Coach will score you at the end.
            </p>
          </div>
        </Card>
      </motion.div>

      <motion.div className="space-y-3" variants={stagger}>
        {modes.map((m) => {
          const active = selectedMode === m.id
          return (
            <motion.button
              key={m.id}
              variants={fadeUp}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedMode(m.id)
                setSelectedTopic(null)
                telegramService.hapticSelection()
              }}
              className={`w-full text-left rounded-2xl p-4 border transition-all ${
                active ? 'border-transparent shadow-lg' : 'border-sm-border'
              }`}
              style={{
                background: active
                  ? 'linear-gradient(135deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))'
                  : 'var(--sm-card)',
                color: active ? 'white' : 'var(--sm-text)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{m.icon}</span>
                  <div>
                    <p className="text-sm font-semibold tracking-tight">{m.title}</p>
                    <p className={`text-xs mt-1 ${active ? 'opacity-90' : 'text-sm-muted'}`}>
                      {m.desc}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-[0.18em] px-2 py-1 rounded-full border ${
                    active
                      ? 'border-white/20 bg-white/10'
                      : 'border-sm-border bg-sm-card2 text-sm-muted'
                  }`}
                >
                  {m.vibe}
                </span>
              </div>
              {/* Active glow */}
              {active && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    boxShadow: '0 0 30px rgba(36,129,204,0.2)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </motion.button>
          )
        })}
      </motion.div>

      <motion.div variants={fadeUp}>
        <SoftCard className="rounded-2xl p-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Topic</p>
            <p className="text-[11px] text-sm-muted">{selectedTopic ? 'Selected' : 'Optional'}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {topicList.map((topic, i) => (
                <motion.button
                  key={topic}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.03 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setSelectedTopic(topic === selectedTopic ? null : topic)
                    telegramService.hapticSelection()
                  }}
                  className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                    selectedTopic === topic
                      ? 'bg-tg-button text-tg-button-text border-transparent'
                      : 'bg-sm-card2 text-sm-text border-sm-border'
                  }`}
                >
                  {topic}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </SoftCard>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-4">
        <Button
          variant="primary"
          size="lg"
          disabled={loading}
          className={`w-full ${!loading ? 'animate-breathe' : ''}`}
          onClick={handleStart}
        >
          {loading ? 'Preparing...' : 'Start'}
        </Button>
        <p className="text-[11px] text-sm-muted mt-2 text-center">
          Tip: speak 60-90 seconds per answer for stronger scoring.
        </p>
      </motion.div>
    </motion.div>
  )
}
