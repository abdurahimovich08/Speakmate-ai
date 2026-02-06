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
