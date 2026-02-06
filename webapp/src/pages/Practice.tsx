/* ===========================
   Practice — Mode & topic selection, then start session
   =========================== */

import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { telegramService } from '../services/telegram'
import type { SessionMode } from '../types'

const modes: { id: SessionMode; icon: string; title: string; desc: string }[] = [
  { id: 'free_speaking', icon: '💬', title: 'Free Speaking', desc: 'Erkin mavzuda suhbat' },
  { id: 'ielts_test', icon: '📝', title: 'IELTS Mock Test', desc: 'IELTS speaking simulyatsiya' },
  { id: 'training', icon: '🏋️', title: 'Training', desc: 'Xatolar bo\'yicha mashq' },
]

const topics: Record<SessionMode, string[]> = {
  free_speaking: [
    'Hobbies & Interests', 'Travel', 'Technology', 'Education',
    'Food & Cooking', 'Sports', 'Music', 'Movies', 'Family', 'Work',
  ],
  ielts_test: [
    'Part 1: Introduction', 'Part 2: Long Turn', 'Part 3: Discussion',
    'Full Test (Parts 1-3)',
  ],
  training: [
    'Grammar Focus', 'Pronunciation', 'Vocabulary Building', 'Fluency',
  ],
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

  const handleStart = useCallback(async () => {
    setLoading(true)
    telegramService.hapticImpact('medium')
    try {
      await startSession(selectedMode, selectedTopic || undefined)
      navigate('/session/active')
    } catch (e) {
      console.error('Failed to start session:', e)
      telegramService.hapticNotification('error')
      await telegramService.alert('Sessiyani boshlashda xatolik yuz berdi. Qaytadan urinib ko\'ring.')
    } finally {
      setLoading(false)
    }
  }, [selectedMode, selectedTopic, startSession, navigate])

  return (
    <div className="p-4 animate-fade-in">
      {/* Mode selection */}
      <h2 className="font-semibold mb-3 text-tg-section-header text-sm uppercase">
        Mashq turi
      </h2>
      <div className="space-y-2 mb-6">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMode(m.id)
              setSelectedTopic(null)
              telegramService.hapticSelection()
            }}
            className={`w-full text-left rounded-xl p-4 transition-all ${
              selectedMode === m.id
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-section text-tg-text'
            }`}
          >
            <span className="text-xl mr-2">{m.icon}</span>
            <span className="font-medium">{m.title}</span>
            <p className={`text-xs mt-0.5 ${
              selectedMode === m.id ? 'text-tg-button-text opacity-80' : 'text-tg-hint'
            }`}>{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Topic selection */}
      <h2 className="font-semibold mb-3 text-tg-section-header text-sm uppercase">
        Mavzu tanlang
      </h2>
      <div className="flex flex-wrap gap-2 mb-8">
        {(topics[selectedMode] || []).map((topic) => (
          <button
            key={topic}
            onClick={() => {
              setSelectedTopic(topic === selectedTopic ? null : topic)
              telegramService.hapticSelection()
            }}
            className={`px-3 py-2 rounded-full text-sm transition-all ${
              selectedTopic === topic
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary text-tg-text'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={loading}
        className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${
          loading
            ? 'bg-tg-hint text-tg-button-text opacity-60'
            : 'bg-tg-button text-tg-button-text active:scale-[0.98]'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin-slow">⏳</span> Tayyorlanmoqda...
          </span>
        ) : (
          '🎙 Mashqni boshlash'
        )}
      </button>
    </div>
  )
}
