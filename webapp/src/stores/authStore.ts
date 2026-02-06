/* ===========================
   Auth Store — Telegram authentication state
   =========================== */

import { create } from 'zustand'
import type { UserProfile } from '../types'
import { authenticateTelegram } from '../services/api'
import { telegramService } from '../services/telegram'

interface AuthState {
  token: string | null
  user: UserProfile | null
  loading: boolean
  error: string | null

  /** Authenticate with Telegram initData */
  login: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  loading: false,
  error: null,

  login: async () => {
    const initData = telegramService.initData
    if (!initData) {
      set({ error: 'Telegram initData not available. Open this app from Telegram.' })
      return
    }

    set({ loading: true, error: null })
    try {
      const { token, user } = await authenticateTelegram(initData)
      set({ token, user, loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Authentication failed'
      set({ error: msg, loading: false })
    }
  },

  logout: () => {
    set({ token: null, user: null })
  },
}))
