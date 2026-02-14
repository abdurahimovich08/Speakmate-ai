/* ===========================
   Auth Store — Telegram authentication state
   =========================== */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { UserProfile } from '../types'
import { authenticateTelegram } from '../services/api'
import { telegramService } from '../services/telegram'

interface AuthState {
  token: string | null
  user: UserProfile | null
  loading: boolean
  error: string | null
  hydrated: boolean

  /** Authenticate with Telegram initData */
  setHydrated: (value: boolean) => void
  login: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,
      hydrated: false,

      setHydrated: (value: boolean) => set({ hydrated: value }),

      login: async () => {
        if (get().loading) return

        const initData = telegramService.initData
        if (!initData) {
          set({ error: 'Telegram initData not available. Open this app from Telegram.' })
          return
        }

        set({ loading: true, error: null })
        try {
          const resp = await authenticateTelegram(initData)
          const token = resp?.token
          const user = resp?.user
          if (!token) {
            set({ error: 'Server returned empty token. Try again.', loading: false })
            return
          }
          set({ token, user: user || null, loading: false })
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Authentication failed'
          set({ error: msg, loading: false })
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null })
      },
    }),
    {
      name: 'speakmate-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)
