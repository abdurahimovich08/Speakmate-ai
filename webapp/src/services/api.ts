/* ===========================
   REST API Service
   =========================== */

import type { Session, UserProfile, ConversationTurn, DetectedError } from '../types'
import { useAuthStore } from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ---- Auth ----
export async function authenticateTelegram(initData: string) {
  return request<{ token: string; user: UserProfile }>('/api/v1/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData }),
  })
}

// ---- User ----
export async function getProfile() {
  return request<UserProfile>('/api/v1/users/me')
}

export async function updateProfile(data: Partial<UserProfile>) {
  return request<UserProfile>('/api/v1/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function getUserStats() {
  return request<Record<string, unknown>>('/api/v1/users/me/stats')
}

// ---- Sessions ----
export async function createSession(mode: string, topic?: string) {
  return request<Session>('/api/v1/sessions/', {
    method: 'POST',
    body: JSON.stringify({ mode, topic }),
  })
}

export async function getSessions(limit = 20) {
  return request<Session[]>(`/api/v1/sessions/?limit=${limit}`)
}

export async function getSession(id: string) {
  return request<Session>(`/api/v1/sessions/${id}`)
}

export async function getConversation(sessionId: string) {
  return request<ConversationTurn[]>(`/api/v1/sessions/${sessionId}/conversation`)
}

export async function getSessionErrors(sessionId: string) {
  return request<DetectedError[]>(`/api/v1/sessions/${sessionId}/errors`)
}

// ---- Feedback ----
export async function getSessionFeedback(sessionId: string) {
  return request<Record<string, unknown>>(`/api/v1/feedback/${sessionId}`)
}

// ---- Super Coach ----
export async function getDailyMission() {
  return request<Record<string, unknown>>('/api/v1/coach/daily-mission')
}

export async function completeDailyMission(
  missionId: string,
  tasksCompleted: number,
  totalTasks: number,
  rating?: number,
) {
  return request<Record<string, unknown>>(`/api/v1/coach/daily-mission/${missionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      tasks_completed: tasksCompleted,
      total_tasks: totalTasks,
      rating,
    }),
  })
}

export async function getCoachSkillGraph() {
  return request<Record<string, unknown>>('/api/v1/coach/skill-graph')
}

export async function getMnemonicDrills(limit = 5) {
  return request<Record<string, unknown>>(`/api/v1/coach/mnemonic-drills?limit=${limit}`)
}

export async function submitMnemonicFeedback(
  errorCode: string,
  style: string,
  helpfulness: number,
  comment?: string,
) {
  return request<Record<string, unknown>>('/api/v1/coach/mnemonic-feedback', {
    method: 'POST',
    body: JSON.stringify({
      error_code: errorCode,
      style,
      helpfulness,
      comment,
    }),
  })
}

export async function getCoachProgressProof(days = 30) {
  return request<Record<string, unknown>>(`/api/v1/coach/progress-proof?days=${days}`)
}

export async function getCoachMemory() {
  return request<Record<string, unknown>>('/api/v1/coach/memory')
}

export async function updateCoachMemory(data: Record<string, unknown>) {
  return request<Record<string, unknown>>('/api/v1/coach/memory', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function clearCoachMemory() {
  return request<Record<string, unknown>>('/api/v1/coach/memory', {
    method: 'DELETE',
  })
}

export async function getSpeakFirstPlan(comfortMode = false) {
  return request<Record<string, unknown>>(`/api/v1/coach/speak-first?comfort_mode=${comfortMode}`)
}

export async function getQuickDiagnosis(transcript?: string) {
  return request<Record<string, unknown>>('/api/v1/coach/diagnosis/free', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  })
}

export async function getShareCard(days = 30) {
  return request<Record<string, unknown>>(`/api/v1/coach/share-card?days=${days}`)
}

export async function getCoachInsights(days = 30) {
  return request<Record<string, unknown>>(`/api/v1/coach/behavior-insights?days=${days}`)
}

export async function getPublicDiagnosis(transcript: string) {
  return request<Record<string, unknown>>('/api/v1/coach/public/diagnosis', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  })
}
