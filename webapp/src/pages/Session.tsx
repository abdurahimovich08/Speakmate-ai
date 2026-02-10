/* ===========================
   Session - Energetic Coach "Call Mode"
   - Tap once to start recording, tap again to stop.
   - Enforces per-mode max speaking time (Free Speaking = 60s, IELTS Part 2 = 120s).
   =========================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useAudio } from '../hooks/useAudio'
import { telegramService } from '../services/telegram'
import Timer from '../components/Timer'
import { Button } from '../components/ui/Button'

function StatusPill({
  tone,
  title,
  subtitle,
}: {
  tone: 'ready' | 'listening' | 'thinking' | 'offline'
  title: string
  subtitle?: string
}) {
  const dotColor =
    tone === 'listening'
      ? 'bg-sm-energy'
      : tone === 'thinking'
        ? 'bg-sm-energy2'
        : tone === 'offline'
          ? 'bg-sm-danger'
          : 'bg-sm-accent'

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-sm-border bg-sm-card2 px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
      <div className="leading-none">
        <p className="text-[11px] font-semibold tracking-tight">{title}</p>
        {subtitle && <p className="text-[10px] text-sm-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function PulseBars({ active }: { active: boolean }) {
  const bars = [0, 1, 2, 3, 4]
  return (
    <div className="flex items-end gap-1 h-6">
      {bars.map((b) => (
        <span
          key={b}
          className="w-1.5 rounded-full"
          style={{
            height: active ? `${10 + ((b * 7) % 18)}px` : '8px',
            background:
              'linear-gradient(180deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))',
            opacity: active ? 0.95 : 0.35,
            animation: active ? `smWave 900ms ${b * 90}ms ease-in-out infinite` : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes smWave {
          0% { transform: translateY(0); opacity: 0.55; }
          50% { transform: translateY(-6px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}

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
    isThinking,
  } = useSessionStore()

  const {
    recording,
    startRecording,
    stopRecording,
    isSupported,
    permissionGranted,
  } = useAudio()

  const [recordSeconds, setRecordSeconds] = useState(0)
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppingRef = useRef(false)
  const feedRef = useRef<HTMLDivElement | null>(null)

  const visibleMessages = useMemo(() => messages.slice(-14), [messages])

  const maxSpeakSeconds = useMemo(() => {
    const mode = session?.mode
    const topic = (session?.topic || '').toLowerCase()

    if (mode === 'ielts_test') {
      if (topic.includes('part 2')) return 120
      return 60
    }
    if (mode === 'free_speaking') return 60
    return 60
  }, [session?.mode, session?.topic])

  const autoFinishAfterTake = useMemo(() => {
    // Product choice: make the loop dead-simple for Telegram users:
    // record once -> analyze. Training can stay multi-turn.
    return session?.mode === 'free_speaking' || session?.mode === 'ielts_test'
  }, [session?.mode])

  useEffect(() => {
    if (scores && session) {
      navigate(`/results/${session.id}`, { replace: true })
    }
  }, [scores, session, navigate])

  useEffect(() => {
    telegramService.webapp?.enableClosingConfirmation()
    return () => telegramService.webapp?.disableClosingConfirmation()
  }, [])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleMessages.length, currentTranscription])

  useEffect(() => {
    if (!recording) {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current)
      recordIntervalRef.current = null
      setRecordSeconds(0)
      stoppingRef.current = false
      return
    }

    setRecordSeconds(0)
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current)
    recordIntervalRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1)
    }, 1000)

    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current)
      recordIntervalRef.current = null
    }
  }, [recording])

  useEffect(() => {
    if (!recording) return
    if (recordSeconds < maxSpeakSeconds) return
    if (stoppingRef.current) return
    stoppingRef.current = true

    // Auto-stop at max duration.
    stopRecording()
      .then(async () => {
        telegramService.hapticNotification('success')
        if (autoFinishAfterTake && !isEnding) {
          await new Promise((r) => setTimeout(r, 250))
          await endSession()
        }
      })
      .catch((err) => console.error(err))
  }, [recording, recordSeconds, maxSpeakSeconds, stopRecording, autoFinishAfterTake, isEnding, endSession])

  const handleEnd = useCallback(async () => {
    await stopRecording()
    await new Promise((resolve) => setTimeout(resolve, 250))
    telegramService.hapticNotification('success')
    await endSession()
  }, [endSession, stopRecording])

  const handleToggleMic = useCallback(async () => {
    if (!isSupported || isEnding) return
    if (!isConnected) return

    try {
      if (recording) {
        telegramService.hapticImpact('light')
        await stopRecording()
        if (autoFinishAfterTake) {
          await new Promise((r) => setTimeout(r, 250))
          await endSession()
        }
      } else {
        telegramService.hapticImpact('heavy')
        await startRecording()
      }
    } catch (err) {
      console.error(err)
      telegramService.hapticNotification('error')
    }
  }, [isSupported, isEnding, isConnected, recording, startRecording, stopRecording, autoFinishAfterTake, endSession])

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen font-ui text-sm-muted p-6 text-center">
        <div className="sm-card p-4">
          <p className="font-semibold">Session not found</p>
          <p className="text-xs text-sm-muted mt-2">Go back and start a new practice.</p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate('/practice')}>
              Start practice
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const title = session.topic || session.mode
  const status = !isConnected
    ? { tone: 'offline' as const, title: 'Offline', subtitle: 'Reconnecting...' }
    : recording
      ? { tone: 'listening' as const, title: 'Listening', subtitle: 'Tap to stop' }
      : isThinking
        ? { tone: 'thinking' as const, title: 'Coach thinking', subtitle: 'Scoring your speech' }
        : { tone: 'ready' as const, title: 'Ready', subtitle: 'Tap mic to start' }

  const remaining = Math.max(0, maxSpeakSeconds - recordSeconds)
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  const micLabel = !isSupported
    ? 'Mic not supported'
    : permissionGranted === false
      ? 'Mic blocked'
      : recording
        ? `Stop (${mm}:${ss})`
        : 'Start recording'

  return (
    <div className="flex flex-col h-screen font-ui bg-sm-bg text-sm-text">
      <div className="px-4 pt-4 pb-3">
        <div className="sm-card p-4 overflow-hidden relative">
          <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-sm-accent via-transparent to-sm-energy2" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Live coaching</p>
              <p className="text-lg font-semibold font-display mt-1 truncate">{title}</p>
              <div className="mt-3 flex items-center gap-3">
                <StatusPill tone={status.tone} title={status.title} subtitle={status.subtitle} />
                <div className="flex items-center gap-2 text-sm-muted">
                  <PulseBars active={recording || isThinking} />
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Timer running={isConnected} className="text-lg text-sm-muted tabular-nums" />
              <div className="mt-2">
                <Button variant="ghost" onClick={handleEnd} disabled={isEnding}>
                  End
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {visibleMessages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[88%] animate-fade-in ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm border border-sm-border ${
                msg.role === 'user'
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-sm-card2 text-sm-text'
              }`}
            >
              {msg.content}
            </div>
            <p className={`text-[10px] mt-1 text-sm-muted ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              {msg.role === 'user' ? 'You' : 'Coach'}
            </p>
          </div>
        ))}

        {currentTranscription && (
          <div className="max-w-[88%] ml-auto animate-fade-in">
            <div className="rounded-2xl px-4 py-3 text-sm border border-sm-border bg-sm-card text-sm-text">
              {currentTranscription}
            </div>
            <p className="text-[10px] mt-1 text-right text-sm-muted">Transcript</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="sm-card p-4">
          <button
            className={`relative w-full rounded-2xl px-5 py-4 border border-sm-border transition-transform active:scale-[0.98] ${
              recording ? 'text-white' : 'text-sm-text'
            }`}
            style={{
              background: recording
                ? 'linear-gradient(90deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))'
                : 'var(--sm-card-2)',
            }}
            disabled={isEnding || !isSupported || !isConnected}
            onClick={handleToggleMic}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <p className="text-sm font-semibold tracking-tight">{micLabel}</p>
                <p className={`text-[11px] mt-0.5 ${recording ? 'opacity-90' : 'text-sm-muted'}`}>
                  {autoFinishAfterTake
                    ? `Auto-finish + analysis after this take. Max ${maxSpeakSeconds}s.`
                    : `Max ${maxSpeakSeconds}s per take. Stop early if you want.`}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
                <MicGlyph />
              </span>
            </div>
          </button>

          {!isSupported && (
            <p className="text-xs text-sm-danger mt-3">
              Your browser does not support microphone recording.
            </p>
          )}

          {isSupported && !isConnected && (
            <p className="text-xs text-sm-danger mt-3">
              WebSocket offline. Wait for reconnect, then try again.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MicGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 14.6a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 12 4a3.6 3.6 0 0 0-3.6 3.6V11a3.6 3.6 0 0 0 3.6 3.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.4 11.4c0 3.7 3 6.4 6.6 6.4s6.6-2.7 6.6-6.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 17.8V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
