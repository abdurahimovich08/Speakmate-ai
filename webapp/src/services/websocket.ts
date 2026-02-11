/* ===========================
   WebSocket Service for real-time conversation
   =========================== */

import type { WSMessage } from '../types'
import { useAuthStore } from '../stores/authStore'

type MessageHandler = (msg: WSMessage) => void

function normalizeWsBase(): string {
  const rawWs = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '')
  const rawApi = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

  const pick = rawWs || rawApi
  if (!pick) return 'ws://localhost:8000'

  const withScheme =
    pick.startsWith('ws://') ||
    pick.startsWith('wss://') ||
    pick.startsWith('http://') ||
    pick.startsWith('https://')
      ? pick
      : `https://${pick}`

  try {
    const parsed = new URL(withScheme)
    const secure = parsed.protocol === 'https:' || parsed.protocol === 'wss:'
    return `${secure ? 'wss' : 'ws'}://${parsed.host}`
  } catch {
    const cleaned = withScheme.replace(/^[a-z]+:\/\//i, '').split('/')[0]
    return `wss://${cleaned}`
  }
}

const WS_BASE = normalizeWsBase()

export class ConversationSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private connectPromise: Promise<void> | null = null
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }
    if (this.connectPromise) {
      return this.connectPromise
    }

    this.connectPromise = new Promise((resolve, reject) => {
      const token = useAuthStore.getState().token || ''
      const url = `${WS_BASE}/ws/conversation/${this.sessionId}?token=${encodeURIComponent(token)}`
      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => {
        if (this.ws !== ws) return
        console.log('[WS] Connected')
        this.startHeartbeat()
        this.connectPromise = null
        resolve()
      }

      ws.onerror = (e) => {
        if (this.ws !== ws) return
        console.error('[WS] Error', e)
        this.connectPromise = null
        reject(e)
      }

      ws.onclose = (e) => {
        if (this.ws !== ws) return
        this.connectPromise = null
        this.stopHeartbeat()
        this.ws = null
        console.log('[WS] Closed', e.code, e.reason)
        this.emit({ type: 'disconnected', data: { code: e.code } })
      }

      ws.onmessage = (event) => {
        if (this.ws !== ws) return
        try {
          const msg: WSMessage = JSON.parse(event.data)
          this.emit(msg)
        } catch {
          console.warn('[WS] Failed to parse message', event.data)
        }
      }
    })
    return this.connectPromise
  }

  get isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING || !!this.connectPromise
  }

  /** Send a typed message to the server */
  send(type: string, data: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  /** Send base64-encoded audio chunk */
  sendAudioChunk(audioBase64: string, isFinal = false, mimeType?: string) {
    this.send('audio_chunk', {
      audio_data: audioBase64,
      is_final: isFinal,
      mime_type: mimeType,
    })
  }

  /** Send text input (testing) */
  sendText(text: string) {
    this.send('text_input', { text })
  }

  /** Request end of session */
  endSession() {
    this.send('end_session', {})
  }

  /** Register event handler */
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)
  }

  /** Remove event handler */
  off(type: string, handler: MessageHandler) {
    const list = this.handlers.get(type)
    if (list) {
      this.handlers.set(type, list.filter((h) => h !== handler))
    }
  }

  /** Disconnect */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.stopHeartbeat()
    this.handlers.clear()
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private emit(msg: WSMessage) {
    // Call type-specific handlers
    const list = this.handlers.get(msg.type) || []
    list.forEach((h) => h(msg))

    // Also call wildcard handlers
    const wildcards = this.handlers.get('*') || []
    wildcards.forEach((h) => h(msg))
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send('get_status', {})
    }, 7000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
