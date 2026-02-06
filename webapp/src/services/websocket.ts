/* ===========================
   WebSocket Service for real-time conversation
   =========================== */

import type { WSMessage } from '../types'
import { useAuthStore } from '../stores/authStore'

type MessageHandler = (msg: WSMessage) => void

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export class ConversationSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
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
        resolve()
      }

      this.ws.onerror = (e) => {
        console.error('[WS] Error', e)
        reject(e)
      }

      this.ws.onclose = (e) => {
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
  sendAudioChunk(audioBase64: string, isFinal = false) {
    this.send('audio_chunk', {
      audio_data: audioBase64,
      is_final: isFinal,
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
}
