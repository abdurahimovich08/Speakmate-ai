/* ===========================
   Session Store — Active conversation session state
   =========================== */

import { create } from 'zustand'
import type {
  Session,
  SessionMode,
  ConversationTurn,
  DetectedError,
  IELTSScores,
  WSTranscription,
  WSAIMessage,
  WSSessionEnded,
} from '../types'
import * as api from '../services/api'
import { ConversationSocket } from '../services/websocket'

interface SessionState {
  // Active session
  session: Session | null
  socket: ConversationSocket | null
  messages: ConversationTurn[]
  currentTranscription: string
  isRecording: boolean
  isConnected: boolean
  isEnding: boolean
  isThinking: boolean

  // Results
  scores: IELTSScores | null
  errors: DetectedError[]
  recommendations: string[]

  // History
  sessions: Session[]
  loadingSessions: boolean

  // Actions
  startSession: (mode: SessionMode, topic?: string) => Promise<void>
  endSession: () => Promise<void>
  setRecording: (recording: boolean) => void
  setTranscription: (text: string) => void
  addMessage: (msg: ConversationTurn) => void
  loadSessions: () => Promise<void>
  reset: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  socket: null,
  messages: [],
  currentTranscription: '',
  isRecording: false,
  isConnected: false,
  isEnding: false,
  isThinking: false,
  scores: null,
  errors: [],
  recommendations: [],
  sessions: [],
  loadingSessions: false,

  startSession: async (mode, topic) => {
    // 1. Create session via REST
    const session = await api.createSession(mode, topic)
    set({
      session,
      messages: [],
      scores: null,
      errors: [],
      recommendations: [],
      isEnding: false,
      isThinking: false,
    })

    // 2. Connect WebSocket
    const socket = new ConversationSocket(session.id)
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    socket.on('connected', () => {
      reconnectAttempts = 0
      clearReconnectTimer()
      set({ isConnected: true })
    })

    socket.on('transcription', (msg) => {
      const data = msg.data as unknown as WSTranscription
      set({ currentTranscription: data.text })
      if (data.is_final) {
        get().addMessage({ role: 'user', content: data.text })
        set({ currentTranscription: '', isThinking: true })
      }
    })

    socket.on('ai_message', (msg) => {
      const data = msg.data as unknown as WSAIMessage
      get().addMessage({ role: 'assistant', content: data.text })
      set({ isThinking: false })
    })

    socket.on('session_ended', (msg) => {
      const data = msg.data as unknown as WSSessionEnded
      set({
        scores: data.scores,
        errors: data.errors,
        recommendations: data.recommendations || [],
        isConnected: false,
        isEnding: false,
        isThinking: false,
      })
    })

    socket.on('disconnected', (msg) => {
      set({ isConnected: false })

      const state = get()
      if (state.isEnding) return
      if (state.socket !== socket) return
      const code = Number((msg.data as Record<string, unknown> | undefined)?.code ?? 0)
      if (code === 1008) return // auth/session ownership issue; don't loop-retry
      if (reconnectAttempts >= 3) return

      reconnectAttempts += 1
      if (socket.isConnected || socket.isConnecting) return
      const delay = 1200 * reconnectAttempts
      reconnectTimer = setTimeout(async () => {
        if (socket.isConnected || socket.isConnecting) return
        try {
          await socket.connect()
        } catch {
          // Next disconnected/error event will trigger retry until limit.
        }
      }, delay)
    })

    try {
      await socket.connect()
    } catch (err) {
      clearReconnectTimer()
      throw err
    }
    set({ socket })
  },

  endSession: async () => {
    const { socket } = get()
    set({ isEnding: true })
    if (socket) {
      socket.endSession()
      // Wait for session_ended event — socket stays open until server sends it
    }
  },

  setRecording: (recording) => set({ isRecording: recording }),
  setTranscription: (text) => set({ currentTranscription: text }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  loadSessions: async () => {
    set({ loadingSessions: true })
    try {
      const sessions = await api.getSessions(50)
      set({ sessions, loadingSessions: false })
    } catch {
      set({ loadingSessions: false })
    }
  },

  reset: () => {
    const { socket } = get()
    socket?.disconnect()
    set({
      session: null,
      socket: null,
      messages: [],
      currentTranscription: '',
      isRecording: false,
      isConnected: false,
      isEnding: false,
      isThinking: false,
      scores: null,
      errors: [],
      recommendations: [],
    })
  },
}))
