/* ===========================
   App — Root component with routing and Telegram init
   =========================== */

import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { telegramService } from './services/telegram'
import { useAuthStore } from './stores/authStore'

import Layout from './components/Layout'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Session from './pages/Session'
import Results from './pages/Results'
import History from './pages/History'
import Profile from './pages/Profile'

export default function App() {
  const { login, loading, error, token } = useAuthStore()
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize Telegram SDK
    telegramService.init()

    // Authenticate
    if (!token) {
      if (telegramService.isAvailable && telegramService.initData) {
        login()
      } else {
        // Running outside Telegram (dev mode)
        setInitError(
          'Bu ilova Telegram ichida ochilishi kerak. @SpeakMateBot ni oching va "Open SpeakMate" tugmasini bosing.',
        )
      }
    }
  }, [])

  // Loading screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text">
        <span className="text-5xl mb-4 animate-spin-slow">🎙</span>
        <p className="text-lg font-semibold">SpeakMate AI</p>
        <p className="text-sm text-tg-hint mt-1">Yuklanmoqda...</p>
      </div>
    )
  }

  // Error screen
  if (error || initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text p-6 text-center">
        <span className="text-5xl mb-4">😕</span>
        <p className="text-lg font-semibold mb-2">Xatolik</p>
        <p className="text-sm text-tg-hint">{error || initError}</p>
        {error && (
          <button
            onClick={() => login()}
            className="mt-4 px-6 py-2 rounded-xl bg-tg-button text-tg-button-text text-sm"
          >
            Qayta urinish
          </button>
        )}
      </div>
    )
  }

  return (
    <Routes>
      {/* Session page has its own full-screen layout (no tabs) */}
      <Route path="/session/active" element={<Session />} />

      {/* Pages with bottom tab bar */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/results/:id" element={<Results />} />
      </Route>
    </Routes>
  )
}
