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

// ---- Super Coach ----
export interface DailyMissionTask {
  id: 'recall' | 'fix' | 'speak'
  title: string
  duration_min: number
  instruction: string
  items: Record<string, unknown>[]
}

export interface DailyMission {
  mission_id: string
  date: string
  total_minutes: number
  difficulty: 'supportive' | 'balanced' | 'advanced'
  best_time_to_practice: {
    hour: number
    window: string
    source: string
  }
  tasks: DailyMissionTask[]
  what_am_i_not_seeing_prompt: string
}

export interface SkillNode {
  skill_id: string
  label: string
  category: string
  score: number
  trend: 'improving' | 'declining' | 'stable'
  trend_delta: number
}

export interface SkillGraph {
  heatmap: SkillNode[]
  top_weak: SkillNode[]
  top_improving: SkillNode[]
  focus_recommendation: string[]
}

export interface MnemonicDrill {
  error_code: string
  category: string
  style: string
  mnemonic: string
  review_schedule_days: number[]
  occurrence_count?: number
  priority?: 'high' | 'medium'
}

export interface CoachMemory {
  goals: string[]
  confidence_blockers: string[]
  preferred_topics: string[]
  notes: string
  panel_hint: string
}

export interface BehaviorInsight {
  risk: string
  what_am_i_not_seeing: string
  action: string
}

export interface ProgressProof {
  status: 'needs_more_data' | 'medium' | 'high'
  confidence: number
  deltas?: {
    band_delta: number
    filler_rate_delta: number
    wpm_delta: number
    pause_count_delta: number
    grammar_accuracy_delta: number
  }
  highlights?: string[]
}

export interface SpeakFirstPlan {
  mode: 'comfort' | 'standard'
  drills: Array<{
    id: string
    title: string
    duration_min: number
    instruction: string
    seconds?: number
  }>
}
