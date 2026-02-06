/* ===========================
   SpeakMate AI — Type definitions
   =========================== */

export type SessionMode = 'free_speaking' | 'ielts_test' | 'training'

export type ErrorCategory = 'pronunciation' | 'grammar' | 'vocabulary' | 'fluency'

export type MessageRole = 'user' | 'assistant' | 'system'

// ---- User ----
export interface UserProfile {
  id: string
  email?: string
  phone?: string
  full_name?: string
  native_language: string
  target_band: number
  telegram_id?: number
  telegram_username?: string
  auth_provider?: string
  created_at: string
}

// ---- Session ----
export interface Session {
  id: string
  user_id: string
  mode: SessionMode
  topic?: string
  duration_seconds: number
  overall_scores?: IELTSScores
  created_at: string
  ended_at?: string
}

export interface IELTSScores {
  fluency_coherence: number
  lexical_resource: number
  grammatical_range: number
  pronunciation: number
  overall_band: number
  word_count?: number
  total_errors?: number
}

// ---- Conversation ----
export interface ConversationTurn {
  id?: string
  role: MessageRole
  content: string
  transcription?: string
  timestamp?: string
}

// ---- Errors ----
export interface DetectedError {
  id?: string
  category: ErrorCategory
  subcategory: string
  original_text: string
  corrected_text: string
  explanation: string
  confidence: number
  timestamp_ms: number
}

// ---- WebSocket messages ----
export interface WSMessage {
  type: string
  data: Record<string, unknown>
}

export interface WSTranscription {
  text: string
  is_final: boolean
  confidence: number
}

export interface WSAIMessage {
  text: string
  role: string
  turn_number?: number
}

export interface WSSessionEnded {
  duration_seconds: number
  turn_count: number
  total_errors: number
  scores: IELTSScores
  errors: DetectedError[]
  message: string
}

// ---- Telegram ----
export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}
