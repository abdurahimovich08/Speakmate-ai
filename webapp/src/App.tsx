/* ===========================
   App - Root component with routing, Telegram init, page transitions
   =========================== */

import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
const Onboarding = lazy(() => import('./pages/Onboarding'))

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.22,
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const { login, loading, error, token, hydrated } = useAuthStore()
  const [initError, setInitError] = useState<string | null>(null)
  const location = useLocation()

  // Scroll management: save scroll position per path, restore on back, reset on forward
  useEffect(() => {
    const key = `sm_scroll_${location.pathname}`
    const saved = sessionStorage.getItem(key)

    // If navigating back/forward (popstate), try to restore scroll
    const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
    if (saved && (navType === 'back_forward' || (window.history.state && window.history.state.idx !== undefined))) {
      window.scrollTo(0, parseInt(saved, 10))
    } else {
      window.scrollTo(0, 0)
    }

    // Save scroll position before leaving this route
    return () => {
      sessionStorage.setItem(`sm_scroll_${location.pathname}`, String(window.scrollY))
    }
  }, [location.pathname])

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

  // Guard: don't render routes until we have a valid token.
  // Without this, Home mounts and fires API calls before login() completes → 403.
  const needsAuth = !token && !error && !initError
  if (!hydrated || loading || needsAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-sm-bg text-sm-text font-ui">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <p className="text-xl font-semibold font-display">SpeakMate</p>
          <p className="text-sm text-sm-muted mt-2">Loading your coach...</p>
          <div className="mt-4 h-1 w-24 mx-auto rounded-full bg-sm-card2 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-sm-accent"
              initial={{ width: '0%' }}
              animate={{ width: '80%' }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
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

  // Check onboarding — localStorage first (fast), then backend verification
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const onboardingDoneLocal = localStorage.getItem('sm_onboarding_done')
  const [onboardingDone, setOnboardingDone] = useState(!!onboardingDoneLocal)

  useEffect(() => {
    if (onboardingDoneLocal || onboardingChecked) return
    // If localStorage says not done, verify with backend
    if (token) {
      import('./services/api').then(({ getProfile }) => {
        getProfile().then((profile) => {
          const p = profile as unknown as Record<string, unknown>
          if (p && p.onboarding_completed_at) {
            localStorage.setItem('sm_onboarding_done', '1')
            setOnboardingDone(true)
          } else if (p && typeof p.onboarding_step === 'number' && (p.onboarding_step as number) > 0) {
            // Resume from saved step (Zeigarnik)
            localStorage.setItem('sm_onboarding_step', String(p.onboarding_step))
          }
          setOnboardingChecked(true)
        }).catch(() => setOnboardingChecked(true))
      })
    }
  }, [token, onboardingDoneLocal, onboardingChecked])

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-sm-bg"><CoachSkeleton /></div>}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Onboarding */}
              {!onboardingDone && (
                <Route path="*" element={
                  <PageWrapper><Onboarding /></PageWrapper>
                } />
              )}

              <Route path="/onboarding" element={
                <PageWrapper><Onboarding /></PageWrapper>
              } />

              <Route path="/session/active" element={
                <ErrorBoundary><Session /></ErrorBoundary>
              } />

              <Route element={<Layout />}>
                <Route path="/" element={
                  <PageWrapper><Home /></PageWrapper>
                } />
                <Route path="/coach" element={
                  <ErrorBoundary fallback={<CoachSkeleton />}>
                    <PageWrapper><Coach /></PageWrapper>
                  </ErrorBoundary>
                } />
                <Route path="/practice" element={
                  <ErrorBoundary>
                    <PageWrapper><Practice /></PageWrapper>
                  </ErrorBoundary>
                } />
                <Route path="/history" element={
                  <ErrorBoundary>
                    <PageWrapper><History /></PageWrapper>
                  </ErrorBoundary>
                } />
                <Route path="/profile" element={
                  <ErrorBoundary>
                    <PageWrapper><Profile /></PageWrapper>
                  </ErrorBoundary>
                } />
                <Route path="/results/:id" element={
                  <ErrorBoundary fallback={<ScoreCardSkeleton />}>
                    <PageWrapper><Results /></PageWrapper>
                  </ErrorBoundary>
                } />
              </Route>
            </Routes>
          </AnimatePresence>
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  )
}
