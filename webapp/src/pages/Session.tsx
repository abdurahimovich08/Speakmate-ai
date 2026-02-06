/* ===========================
   Session — Real-time conversation with AI
   Active speaking session with audio recording.
   =========================== */

import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useAudio } from '../hooks/useAudio'
import { telegramService } from '../services/telegram'
import Timer from '../components/Timer'

export default function Session() {
  const navigate = useNavigate()
  const {
    session,
    messages,
    currentTranscription,
    isConnected,
    isEnding,
    scores,
    endSession,
  } = useSessionStore()

  const { recording, toggleRecording, stopRecording, isSupported } = useAudio()

  // If session ended (scores received), navigate to results
  useEffect(() => {
    if (scores && session) {
      navigate(`/results/${session.id}`, { replace: true })
    }
  }, [scores, session, navigate])

  // Prevent accidental close
  useEffect(() => {
    telegramService.webapp?.enableClosingConfirmation()
    return () => {
      telegramService.webapp?.disableClosingConfirmation()
    }
  }, [])

  // Back button = end session
  useEffect(() => {
    if (!telegramService.isAvailable) return
    const handleBack = async () => {
      const ok = await telegramService.confirm('Sessiyani yakunlamoqchimisiz?')
      if (ok) handleEnd()
    }
    telegramService.showBackButton(handleBack)
    return () => {
      telegramService.webapp?.BackButton.offClick(handleBack)
    }
  }, [])

  const handleEnd = useCallback(async () => {
    stopRecording()
    telegramService.hapticNotification('success')
    await endSession()
  }, [endSession, stopRecording])

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen text-tg-hint">
        <p>Sessiya topilmadi. <button className="text-tg-link" onClick={() => navigate('/practice')}>Qayta boshlash</button></p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-tg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-tg-section border-b border-tg-secondary">
        <div>
          <p className="font-semibold text-sm">{session.topic || session.mode}</p>
          <p className="text-xs text-tg-hint flex items-center gap-1">
            {isConnected ? (
              <><span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span> Ulangan</>
            ) : (
              <><span className="w-2 h-2 bg-red-500 rounded-full inline-block"></span> Uzilgan</>
            )}
          </p>
        </div>
        <Timer running={isConnected} className="text-lg text-tg-hint" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] animate-fade-in ${
              msg.role === 'user' ? 'ml-auto' : 'mr-auto'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-tg-button text-tg-button-text rounded-br-md'
                  : 'bg-tg-secondary text-tg-text rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
            <p className={`text-[10px] mt-0.5 text-tg-hint ${
              msg.role === 'user' ? 'text-right' : 'text-left'
            }`}>
              {msg.role === 'user' ? 'Siz' : 'AI Coach'}
            </p>
          </div>
        ))}

        {/* Live transcription */}
        {currentTranscription && (
          <div className="max-w-[85%] ml-auto animate-fade-in">
            <div className="rounded-2xl px-4 py-3 text-sm bg-tg-button/50 text-tg-button-text rounded-br-md italic">
              {currentTranscription}...
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-4 bg-tg-section border-t border-tg-secondary">
        {!isSupported ? (
          <p className="text-center text-sm text-red-500">
            Brauzeringiz mikrofon yozishni qo'llab-quvvatlamaydi.
          </p>
        ) : (
          <div className="flex items-center justify-center gap-4">
            {/* Record button */}
            <button
              onClick={() => {
                telegramService.hapticImpact(recording ? 'light' : 'heavy')
                toggleRecording()
              }}
              disabled={isEnding}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                recording
                  ? 'bg-red-500 text-white scale-110'
                  : 'bg-tg-button text-tg-button-text'
              } ${isEnding ? 'opacity-50' : 'active:scale-95'}`}
            >
              {/* Pulse ring when recording */}
              {recording && (
                <span className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse-ring" />
              )}
              <span className="text-3xl relative z-10">
                {recording ? '⏹' : '🎙'}
              </span>
            </button>

            {/* End session */}
            <button
              onClick={handleEnd}
              disabled={isEnding}
              className="px-6 py-3 rounded-xl bg-tg-secondary text-tg-text text-sm font-medium active:scale-95 transition-transform"
            >
              {isEnding ? '⏳ Yakunlanmoqda...' : '✅ Yakunlash'}
            </button>
          </div>
        )}

        {recording && (
          <p className="text-center text-xs text-red-500 mt-2 animate-pulse">
            🔴 Yozib olinmoqda... Gapiring!
          </p>
        )}
      </div>
    </div>
  )
}
