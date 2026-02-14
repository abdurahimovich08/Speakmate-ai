/* ===========================
   Gamification Store — Streak, XP, Level, Achievements
   =========================== */

import { create } from 'zustand'
import * as api from '../services/api'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
  earned_at?: string
}

export interface StreakData {
  current_streak: number
  longest_streak: number
  today_completed: boolean
  last_session_hours_ago: number | null
  xp_today: number
  total_xp: number
  level: number
  level_name: string
  xp_to_next_level: number
  achievements: Achievement[]
}

interface GamificationState {
  streak: StreakData | null
  loading: boolean
  xpGained: number | null // for animation
  leveledUp: boolean

  loadStreak: () => Promise<void>
  setXpGained: (xp: number | null) => void
  setLeveledUp: (v: boolean) => void
}

const defaultStreak: StreakData = {
  current_streak: 0,
  longest_streak: 0,
  today_completed: false,
  last_session_hours_ago: null,
  xp_today: 0,
  total_xp: 0,
  level: 1,
  level_name: 'First Words',
  xp_to_next_level: 100,
  achievements: [],
}

export const useGamificationStore = create<GamificationState>((set) => ({
  streak: null,
  loading: false,
  xpGained: null,
  leveledUp: false,

  loadStreak: async () => {
    set({ loading: true })
    try {
      const data = await api.getStreakData()
      set({ streak: data as unknown as StreakData, loading: false })
    } catch {
      // If endpoint doesn't exist yet, use defaults
      set({ streak: defaultStreak, loading: false })
    }
  },

  setXpGained: (xp) => set({ xpGained: xp }),
  setLeveledUp: (v) => set({ leveledUp: v }),
}))
