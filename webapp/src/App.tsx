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
  const { login, loading, error, token } = useAuthStore()
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    telegramService.init()

    if (!token) {
      if (telegramService.isAvailable && telegramService.initData) {
        login()
      } else {
        setInitError(
          'This app should be opened inside Telegram. Open @SpeakMateBot and tap Open SpeakMate.',
        )
      }
    }
  }, [token, login])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text">
        <p className="text-lg font-semibold">SpeakMate AI</p>
        <p className="text-sm text-tg-hint mt-1">Loading...</p>
      </div>
    )
  }

  if (error || initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text p-6 text-center">
        <p className="text-lg font-semibold mb-2">Error</p>
        <p className="text-sm text-tg-hint">{error || initError}</p>
        {error && (
          <button
            onClick={() => login()}
            className="mt-4 px-6 py-2 rounded-xl bg-tg-button text-tg-button-text text-sm"
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
