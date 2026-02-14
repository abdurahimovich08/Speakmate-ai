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

export interface IELTSCriterionDetail {
  band: number
  evidence?: string[]
  descriptor?: string
  error_count?: number
}

export interface IELTSScores {
  fluency_coherence: number | IELTSCriterionDetail
  lexical_resource: number | IELTSCriterionDetail
  grammatical_range: number | IELTSCriterionDetail
  pronunciation: number | IELTSCriterionDetail
  overall_band: number
  summary?: string
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

export interface CoachingTip {
  category: ErrorCategory
  subcategory?: string
  error_code?: string
  original: string
  corrected: string
  explanation: string
  tip: string
  severity: string
  strategy?: string
}

export interface PronunciationReport {
  overall_score?: number
  band_estimate?: number
  intelligibility?: {
    score: number
    avg_confidence: number
    low_confidence_words: number
    likely_issues: Array<{
      word: string
      confidence: number
      issue_type: string
      suggestion: string
    }>
  }
  prosody?: {
    score: number
    speaking_rate_wpm: number
    pause_count: number
    avg_pause_ms: number
    filler_rate: number
  }
  feedback?: string[]
  problem_areas?: Array<{
    area: string
    severity: string
    description: string
    drill_type: string
  }>
}

export interface TrainingPlan {
  duration_days?: number
  focus_areas?: string[]
  daily_tasks?: Array<{
    day: number
    focus: string
    tasks: string[]
    estimated_minutes: number
  }>
}

export interface Recommendation {
  priority?: string
  area?: string
  recommendation: string
  resources?: string[]
}

export interface WSSessionEnded {
  duration_seconds: number
  turn_count: number
  total_errors: number
  scores: IELTSScores
  errors: DetectedError[]
  pronunciation?: PronunciationReport
  recommendations?: Recommendation[]
  coaching_tips?: CoachingTip[]
  coaching_summary?: {
    total_turns: number
    total_errors_detected: number
    coaching_tips_given: number
    errors_by_category: Record<string, number>
  }
  training_plan?: TrainingPlan
  message: string
}

export interface SessionFeedback {
  session_id: string
  overall_band?: number
  scores: IELTSScores
  errors: DetectedError[]
  summary?: string
  recommendations?: string[]
  strengths?: string[]
}

// ---- Criterion Feedback (per-criterion detailed analysis) ----
export interface CriterionWeakness {
  issue: string
  example: string
  fix: string
  rule?: string
}

export interface CriterionFeedback {
  score_explanation: string
  strengths: string[]
  weaknesses: CriterionWeakness[]
  tips: string[]
  metrics_summary: string
}

export interface FullCriterionFeedback {
  fluency_coherence: CriterionFeedback
  lexical_resource: CriterionFeedback
  grammatical_range: CriterionFeedback
  pronunciation: CriterionFeedback
  overall_strengths: string[]
  corrected_sample: string
}

// ---- Computed Metrics ----
export interface FluencyMetrics {
  word_count: number
  sentence_count: number
  avg_sentence_length: number
  discourse_markers: number
  filler_count: number
  filler_density: number
  self_correction_count: number
}

export interface LexicalMetrics {
  word_count: number
  unique_word_count: number
  ttr: number
  basic_word_ratio: number
  advanced_word_ratio: number
  advanced_words: string[]
  collocation_count: number
  idiom_count: number
}

export interface GrammarMetrics {
  sentence_count: number
  simple_sentences: number
  compound_sentences: number
  complex_sentences: number
  structure_variety_ratio: number
  tenses_used: string[]
  tense_variety: number
  complex_features: string[]
  complex_feature_count: number
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
