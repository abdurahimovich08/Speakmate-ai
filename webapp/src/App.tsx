/* ===========================
   App - Root component with routing and Telegram init
   =========================== */

import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { telegramService } from './services/telegram'
import { useAuthStore } from './stores/authStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import { CoachSkeleton, ScoreCardSkeleton } from './components/ui/Skeleton'

import Layout from './components/Layout'
import Home from './pages/Home'

// Lazy-loaded route components (code splitting)
const Coach = lazy(() => import('./pages/Coach'))
const Practice = lazy(() => import('./pages/Practice'))
const Session = lazy(() => import('./pages/Session'))
const Results = lazy(() => import('./pages/Results'))
const History = lazy(() => import('./pages/History'))
const Profile = lazy(() => import('./pages/Profile'))

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
    <ToastProvider>
      <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-sm-bg"><CoachSkeleton /></div>}>
          <Routes>
            <Route path="/session/active" element={
              <ErrorBoundary><Session /></ErrorBoundary>
            } />

            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/coach" element={
                <ErrorBoundary fallback={<CoachSkeleton />}><Coach /></ErrorBoundary>
              } />
              <Route path="/practice" element={
                <ErrorBoundary><Practice /></ErrorBoundary>
              } />
              <Route path="/history" element={
                <ErrorBoundary><History /></ErrorBoundary>
              } />
              <Route path="/profile" element={
                <ErrorBoundary><Profile /></ErrorBoundary>
              } />
              <Route path="/results/:id" element={
                <ErrorBoundary fallback={<ScoreCardSkeleton />}><Results /></ErrorBoundary>
              } />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  )
}
