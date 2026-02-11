/* ===========================
   App - Root component with routing and Telegram init
   =========================== */

import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { telegramService } from './services/telegram'
import { useAuthStore } from './stores/authStore'

import Layout from './components/Layout'
import Home from './pages/Home'
import Coach from './pages/Coach'
import Practice from './pages/Practice'
import Session from './pages/Session'
import Results from './pages/Results'
import History from './pages/History'
import Profile from './pages/Profile'

export default function App() {
  const { login, loading, error, token, hydrated } = useAuthStore()
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    telegramService.init()
  }, [])

  useEffect(() => {
    if (!hydrated) return

    if (token) {
      if (initError) setInitError(null)
      return
    }

    if (telegramService.isAvailable && telegramService.initData) {
      login()
    } else {
      setInitError(
        'This app should be opened inside Telegram. Open @SpeakMateBot and tap Open SpeakMate.',
      )
    }
  }, [hydrated, token, login, initError])

  if (!hydrated || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-sm-bg text-sm-text font-ui">
        <p className="text-xl font-semibold font-display">SpeakMate</p>
        <p className="text-sm text-sm-muted mt-2">Loading your coach...</p>
      </div>
    )
  }

  if (error || initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-sm-bg text-sm-text font-ui p-6 text-center">
        <p className="text-lg font-semibold mb-2 font-display">Oops</p>
        <p className="text-sm text-sm-muted">{error || initError}</p>
        {error && (
          <button
            onClick={() => login()}
            className="mt-5 sm-btn-primary"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/session/active" element={<Session />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/results/:id" element={<Results />} />
      </Route>
    </Routes>
  )
}
