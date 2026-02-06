// SpeakMate AI - TypeScript Types

// User types
export interface User {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
  native_language: string;
  target_band: number;
  avatar_url?: string;
  created_at: string;
}

export interface UserProfile extends User {
  total_sessions: number;
  average_band: number;
}

// Session types
export type SessionMode = 'free_speaking' | 'ielts_test' | 'training';

export interface Session {
  id: string;
  user_id: string;
  mode: SessionMode;
  topic?: string;
  duration_seconds: number;
  overall_scores?: IELTSScores;
  created_at: string;
  ended_at?: string;
}

export interface SessionCreate {
  mode: SessionMode;
  topic?: string;
}

// Conversation types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ConversationTurn {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  transcription?: string;
  duration_ms?: number;
  sequence_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

// Error types
export type ErrorCategory = 'pronunciation' | 'grammar' | 'vocabulary' | 'fluency';

export interface DetectedError {
  id: string;
  session_id: string;
  category: ErrorCategory;
  subcategory: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
  confidence: number;
  timestamp_ms: number;
}

export interface ErrorProfile {
  category: ErrorCategory;
  subcategory: string;
  occurrence_count: number;
  improvement_rate: number;
  last_occurred: string;
}

// Score types
export interface IELTSScores {
  fluency_coherence: number;
  lexical_resource: number;
  grammatical_range: number;
  pronunciation: number;
  overall_band: number;
}

export interface SessionFeedback {
  session_id: string;
  overall_band: number;
  scores: IELTSScores;
  errors: DetectedError[];
  summary: string;
  recommendations: string[];
  strengths: string[];
}

// WebSocket types
export interface WSMessage {
  type: string;
  data: Record<string, any>;
}

export interface TranscriptionResult {
  text: string;
  is_final: boolean;
  confidence: number;
}

// Navigation types
export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'session/[id]': { id: string };
  'results/[id]': { id: string };
};

// Stats types
export interface UserStats {
  total_sessions: number;
  total_practice_minutes: number;
  average_band: number;
  sessions_this_week: number;
  top_error_categories: ErrorProfile[];
  improvement_trend: 'improving' | 'stable' | 'declining';
}

// IELTS Topic types
export interface IELTSTopic {
  id: number;
  part: 1 | 2 | 3;
  category: string;
  topic: string;
  questions: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}
