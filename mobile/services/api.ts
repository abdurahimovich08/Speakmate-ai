/**
 * SpeakMate AI - REST API Client
 */
import { API_CONFIG, ERROR_MESSAGES } from '@/constants/Config';
import { supabase } from './supabase';
import type {
  Session,
  SessionCreate,
  SessionFeedback,
  UserStats,
  ErrorProfile,
  DailyMission,
  MnemonicDrill,
  SkillGraph,
  CoachMemory,
  ProgressProof,
  BehaviorInsight,
} from '@/types';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_CONFIG.BASE_URL}/api/${API_CONFIG.API_VERSION}`;
  }

  /**
   * Get auth headers with Supabase token
   */
  private async getHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Make API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.getHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || ERROR_MESSAGES.GENERIC_ERROR);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
      }
      throw error;
    }
  }

  // User endpoints
  async getCurrentUser() {
    return this.request<any>('/users/me');
  }

  async updateProfile(data: { full_name?: string; native_language?: string; target_band?: number }) {
    return this.request<any>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserStats(): Promise<UserStats> {
    return this.request<UserStats>('/users/me/stats');
  }

  async getUserErrorProfile(): Promise<ErrorProfile[]> {
    return this.request<ErrorProfile[]>('/users/me/error-profile');
  }

  // Session endpoints
  async createSession(data: SessionCreate): Promise<Session> {
    return this.request<Session>('/sessions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSessions(limit = 20): Promise<Session[]> {
    return this.request<Session[]>(`/sessions/?limit=${limit}`);
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/sessions/${sessionId}`);
  }

  async getSessionConversation(sessionId: string): Promise<any[]> {
    return this.request<any[]>(`/sessions/${sessionId}/conversation`);
  }

  async getRawSessionErrors(sessionId: string): Promise<any[]> {
    return this.request<any[]>(`/sessions/${sessionId}/errors`);
  }

  async endSession(sessionId: string, durationSeconds: number): Promise<Session> {
    return this.request<Session>(
      `/sessions/${sessionId}/end?duration_seconds=${durationSeconds}`,
      { method: 'PUT' }
    );
  }

  // Feedback endpoints
  async getSessionFeedback(sessionId: string): Promise<SessionFeedback> {
    return this.request<SessionFeedback>(`/feedback/${sessionId}`);
  }

  async generatePdfReport(sessionId: string, includeDetails = true): Promise<{ report_path: string }> {
    return this.request<{ report_path: string }>(`/feedback/${sessionId}/pdf`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        include_details: includeDetails,
      }),
    });
  }

  async getWeeklySummary(): Promise<any> {
    return this.request<any>('/feedback/summary/weekly');
  }

  // Analysis endpoints (Stimuler-style detailed analysis)
  async getSessionAnalysis(sessionId: string): Promise<any> {
    return this.request<any>(`/analysis/sessions/${sessionId}`);
  }

  async triggerReanalysis(sessionId: string, analysisType: 'fast' | 'deep' = 'deep'): Promise<any> {
    return this.request<any>(`/analysis/sessions/${sessionId}/reanalyze`, {
      method: 'POST',
      body: JSON.stringify({ analysis_type: analysisType }),
    });
  }

  async getSessionErrors(sessionId: string, category?: string): Promise<any[]> {
    const params = category ? `?category=${category}` : '';
    return this.request<any[]>(`/analysis/sessions/${sessionId}/errors${params}`);
  }

  async getSessionScores(sessionId: string): Promise<any> {
    return this.request<any>(`/analysis/sessions/${sessionId}/scores`);
  }

  async requestPdfGeneration(sessionId: string): Promise<{ job_id: string; status: string }> {
    return this.request<{ job_id: string; status: string }>(`/analysis/sessions/${sessionId}/pdf`, {
      method: 'POST',
    });
  }

  async getUserAnalysisSummary(): Promise<any> {
    return this.request<any>('/analysis/user/summary');
  }

  // Training endpoints
  async getTrainingTasks(status?: string, limit = 20): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    return this.request<any[]>(`/training/tasks?${params.toString()}`);
  }

  async completeTrainingTask(taskId: string, score: number): Promise<any> {
    const wasCorrect = score <= 1 ? score >= 0.7 : score >= 70;
    return this.request<any>(`/training/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ score, was_correct: wasCorrect }),
    });
  }

  async getTrainingPlan(): Promise<any> {
    return this.request<any>('/training/plan');
  }

  async getTrainingProgress(): Promise<any> {
    return this.request<any>('/training/progress');
  }

  // Super Coach endpoints
  async getDailyMission(): Promise<DailyMission> {
    return this.request<DailyMission>('/coach/daily-mission');
  }

  async completeDailyMission(
    missionId: string,
    tasksCompleted: number,
    totalTasks: number,
    rating?: number
  ): Promise<{ status: string; mission_id: string; success_rate: number }> {
    return this.request<{ status: string; mission_id: string; success_rate: number }>(
      `/coach/daily-mission/${missionId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({
          tasks_completed: tasksCompleted,
          total_tasks: totalTasks,
          rating,
        }),
      }
    );
  }

  async getMnemonicDrills(limit = 5): Promise<{ drills: MnemonicDrill[]; persistence: { created: number; updated: number } }> {
    return this.request<{ drills: MnemonicDrill[]; persistence: { created: number; updated: number } }>(
      `/coach/mnemonic-drills?limit=${limit}`
    );
  }

  async submitMnemonicFeedback(
    errorCode: string,
    style: string,
    helpfulness: number,
    comment?: string
  ): Promise<{ status: string; average_helpfulness: number; samples: number }> {
    return this.request<{ status: string; average_helpfulness: number; samples: number }>(
      '/coach/mnemonic-feedback',
      {
        method: 'POST',
        body: JSON.stringify({
          error_code: errorCode,
          style,
          helpfulness,
          comment,
        }),
      }
    );
  }

  async getSkillGraph(): Promise<SkillGraph> {
    return this.request<SkillGraph>('/coach/skill-graph');
  }

  async getCoachMemory(): Promise<CoachMemory> {
    return this.request<CoachMemory>('/coach/memory');
  }

  async updateCoachMemory(patch: Partial<CoachMemory>): Promise<CoachMemory> {
    return this.request<CoachMemory>('/coach/memory', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  async clearCoachMemory(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/coach/memory', {
      method: 'DELETE',
    });
  }

  async getProgressProof(days = 30): Promise<{ proof: ProgressProof; session_count: number }> {
    return this.request<{ proof: ProgressProof; session_count: number }>(`/coach/progress-proof?days=${days}`);
  }

  async getSpeakFirstPlan(comfortMode = false): Promise<any> {
    return this.request<any>(`/coach/speak-first?comfort_mode=${comfortMode}`);
  }

  async getQuickDiagnosis(transcript?: string): Promise<any> {
    return this.request<any>('/coach/diagnosis/free', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  }

  async getPublicDiagnosis(transcript: string): Promise<any> {
    return this.request<any>('/coach/public/diagnosis', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  }

  async getShareCard(days = 30): Promise<any> {
    return this.request<any>(`/coach/share-card?days=${days}`);
  }

  async getBehaviorInsights(days = 30): Promise<{ insights: BehaviorInsight[]; mission_completion_rate?: number }> {
    return this.request<{ insights: BehaviorInsight[]; mission_completion_rate?: number }>(
      `/coach/behavior-insights?days=${days}`
    );
  }
}

export const api = new ApiClient();
