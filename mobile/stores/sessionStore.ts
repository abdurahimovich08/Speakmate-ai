/**
 * SpeakMate AI - Session Store (Zustand)
 */
import { create } from 'zustand';
import { api } from '@/services/api';
import { createConversationSocket, ConversationWebSocket } from '@/services/websocket';
import type {
  Session,
  SessionMode,
  ChatMessage,
  DetectedError,
  IELTSScores,
  SessionFeedback,
} from '@/types';

interface SessionState {
  // Current session
  currentSession: Session | null;
  isSessionActive: boolean;

  // Conversation
  messages: ChatMessage[];
  isAiTyping: boolean;
  currentTranscription: string;

  // WebSocket
  socket: ConversationWebSocket | null;
  isConnected: boolean;

  // Session results
  errors: DetectedError[];
  scores: IELTSScores | null;
  feedback: SessionFeedback | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Session history
  recentSessions: Session[];

  // Actions
  startSession: (mode: SessionMode, topic?: string) => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (text: string) => void;
  addMessage: (message: ChatMessage) => void;
  setTranscription: (text: string) => void;
  loadSessions: () => Promise<void>;
  loadSessionFeedback: (sessionId: string) => Promise<void>;
  clearSession: () => void;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  isSessionActive: false,
  messages: [],
  isAiTyping: false,
  currentTranscription: '',
  socket: null,
  isConnected: false,
  errors: [],
  scores: null,
  feedback: null,
  isLoading: false,
  error: null,
  recentSessions: [],

  startSession: async (mode: SessionMode, topic?: string) => {
    try {
      set({ isLoading: true, error: null });

      // Create session on backend
      const session = await api.createSession({ mode, topic });

      set({
        currentSession: session,
        isSessionActive: true,
        messages: [],
        errors: [],
        scores: null,
      });

      // Connect WebSocket
      const socket = createConversationSocket(session.id);

      socket.onConnect(() => {
        set({ isConnected: true });
      });

      socket.onDisconnect(() => {
        set({ isConnected: false });
      });

      socket.onMessage((message) => {
        const { type, data } = message;

        switch (type) {
          case 'connected':
            console.log('Session connected:', data.message);
            break;

          case 'ai_message':
            const aiMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.text,
              timestamp: new Date(),
            };
            set((state) => ({
              messages: [...state.messages, aiMessage],
              isAiTyping: false,
            }));
            break;

          case 'transcription':
            set({ currentTranscription: data.text });
            if (data.is_final) {
              const userMessage: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: data.text,
                timestamp: new Date(),
              };
              set((state) => ({
                messages: [...state.messages, userMessage],
                currentTranscription: '',
                isAiTyping: true,
              }));
            }
            break;

          case 'session_ended':
            set({
              errors: data.errors || [],
              scores: data.scores || null,
              isSessionActive: false,
            });
            break;

          case 'error':
            set({ error: data.message });
            break;
        }
      });

      socket.onError((error) => {
        set({ error: error.message });
      });

      await socket.connect();

      set({ socket, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
        isSessionActive: false,
      });
      throw error;
    }
  },

  endSession: async () => {
    try {
      const { socket, currentSession } = get();

      if (socket) {
        socket.endSession();
        // Wait a bit for final data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        socket.disconnect();
      }

      if (currentSession) {
        // Calculate duration
        const startTime = new Date(currentSession.created_at).getTime();
        const duration = Math.floor((Date.now() - startTime) / 1000);

        await api.endSession(currentSession.id, duration);
      }

      set({
        socket: null,
        isConnected: false,
        isSessionActive: false,
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  sendMessage: (text: string) => {
    const { socket, isConnected } = get();

    if (socket && isConnected) {
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, userMessage],
        isAiTyping: true,
      }));

      // Send to backend
      socket.sendTextInput(text);
    }
  },

  addMessage: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setTranscription: (text: string) => {
    set({ currentTranscription: text });
  },

  loadSessions: async () => {
    try {
      set({ isLoading: true, error: null });

      const sessions = await api.getSessions(20);

      set({
        recentSessions: sessions,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  loadSessionFeedback: async (sessionId: string) => {
    try {
      set({ isLoading: true, error: null });

      const feedback = await api.getSessionFeedback(sessionId);

      set({
        feedback,
        errors: feedback.errors,
        scores: feedback.scores,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  clearSession: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }

    set({
      currentSession: null,
      isSessionActive: false,
      messages: [],
      isAiTyping: false,
      currentTranscription: '',
      socket: null,
      isConnected: false,
      errors: [],
      scores: null,
      feedback: null,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
