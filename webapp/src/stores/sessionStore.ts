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

  // Results
  scores: IELTSScores | null
  errors: DetectedError[]

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
  scores: null,
  errors: [],
  sessions: [],
  loadingSessions: false,

  startSession: async (mode, topic) => {
    // 1. Create session via REST
    const session = await api.createSession(mode, topic)
    set({ session, messages: [], scores: null, errors: [], isEnding: false })

    // 2. Connect WebSocket
    const socket = new ConversationSocket(session.id)

    socket.on('connected', () => {
      set({ isConnected: true })
    })

    socket.on('transcription', (msg) => {
      const data = msg.data as unknown as WSTranscription
      set({ currentTranscription: data.text })
      if (data.is_final) {
        get().addMessage({ role: 'user', content: data.text })
        set({ currentTranscription: '' })
      }
    })

    socket.on('ai_message', (msg) => {
      const data = msg.data as unknown as WSAIMessage
      get().addMessage({ role: 'assistant', content: data.text })
    })

    socket.on('session_ended', (msg) => {
      const data = msg.data as unknown as WSSessionEnded
      set({
        scores: data.scores,
        errors: data.errors,
        isConnected: false,
        isEnding: false,
      })
    })

    socket.on('disconnected', () => {
      set({ isConnected: false })
    })

    await socket.connect()
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
      scores: null,
      errors: [],
    })
  },
}))
