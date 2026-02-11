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

  if (pick.startsWith('ws://') || pick.startsWith('wss://')) return pick
  if (pick.startsWith('https://')) return `wss://${pick.slice('https://'.length)}`
  if (pick.startsWith('http://')) return `ws://${pick.slice('http://'.length)}`
  return `wss://${pick}`
}

const WS_BASE = normalizeWsBase()

export class ConversationSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = useAuthStore.getState().token || ''
      const url = `${WS_BASE}/ws/conversation/${this.sessionId}?token=${token}`

      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[WS] Connected')
        this.startHeartbeat()
        resolve()
      }

      this.ws.onerror = (e) => {
        console.error('[WS] Error', e)
        reject(e)
      }

      this.ws.onclose = (e) => {
        this.stopHeartbeat()
        console.log('[WS] Closed', e.code, e.reason)
        this.emit({ type: 'disconnected', data: { code: e.code } })
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)
          this.emit(msg)
        } catch {
          console.warn('[WS] Failed to parse message', event.data)
        }
      }
    })
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
