/* ===========================
   Practice - Energetic setup: mode + topic + start
   =========================== */

import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
}> = [
  {
    id: 'free_speaking',
    title: 'Free Speaking',
    desc: 'Real conversation. Fast feedback.',
    vibe: 'ENERGY',
  },
  {
    id: 'ielts_test',
    title: 'IELTS Mock',
    desc: 'Exam-style prompts + scoring.',
    vibe: 'FOCUS',
  },
  {
    id: 'training',
    title: 'Training',
    desc: 'Fix recurring mistakes with drills.',
    vibe: 'BUILD',
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

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-sm border border-sm-border transition-transform active:scale-[0.98] ${
        active ? 'bg-tg-button text-tg-button-text' : 'bg-sm-card2 text-sm-text'
      }`}
    >
      {children}
    </button>
  )
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
    <div className="p-4 animate-fade-in font-ui">
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

      <div className="space-y-3">
        {modes.map((m) => {
          const active = selectedMode === m.id
          return (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMode(m.id)
                setSelectedTopic(null)
                telegramService.hapticSelection()
              }}
              className={`w-full text-left rounded-2xl p-4 border transition-transform active:scale-[0.99] ${
                active ? 'border-transparent' : 'border-sm-border'
              }`}
              style={{
                background: active
                  ? 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))'
                  : 'var(--sm-card)',
                color: active ? 'white' : 'var(--sm-text)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">{m.title}</p>
                  <p className={`text-xs mt-1 ${active ? 'opacity-90' : 'text-sm-muted'}`}>{m.desc}</p>
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-[0.18em] px-2 py-1 rounded-full border ${
                    active ? 'border-white/20 bg-white/10' : 'border-sm-border bg-sm-card2 text-sm-muted'
                  }`}
                >
                  {m.vibe}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <SoftCard className="rounded-2xl p-4 mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Topic</p>
          <p className="text-[11px] text-sm-muted">{selectedTopic ? 'Selected' : 'Optional'}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {topicList.map((topic) => (
            <Chip
              key={topic}
              active={selectedTopic === topic}
              onClick={() => {
                setSelectedTopic(topic === selectedTopic ? null : topic)
                telegramService.hapticSelection()
              }}
            >
              {topic}
            </Chip>
          ))}
        </div>
      </SoftCard>

      <div className="mt-4">
        <Button
          variant="primary"
          size="lg"
          disabled={loading}
          className="w-full"
          onClick={handleStart}
        >
          {loading ? 'Preparing...' : 'Start'}
        </Button>
        <p className="text-[11px] text-sm-muted mt-2 text-center">
          Tip: speak 60-90 seconds per answer for stronger scoring.
        </p>
      </div>
    </div>
  )
}

