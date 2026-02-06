/**
 * SpeakMate AI - WebSocket Service for Real-time Conversation
 */
import { API_CONFIG } from '@/constants/Config';
import { supabase } from './supabase';
import type { WSMessage, TranscriptionResult, ChatMessage } from '@/types';

type MessageHandler = (message: WSMessage) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionHandler = () => void;

export class ConversationWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: ConnectionHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    try {
      // Get auth token
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || '';

      // Build WebSocket URL
      const wsUrl = `${API_CONFIG.WS_URL}/ws/conversation/${this.sessionId}?token=${token}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.connectHandlers.forEach((handler) => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.messageHandlers.forEach((handler) => handler(message));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        const error = new Error('WebSocket connection error');
        this.errorHandlers.forEach((handler) => handler(error));
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.disconnectHandlers.forEach((handler) => handler());

        // Attempt reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Send audio chunk
   */
  sendAudioChunk(audioData: string, isFinal = false): void {
    this.send({
      type: 'audio_chunk',
      data: {
        audio_data: audioData,
        is_final: isFinal,
      },
    });
  }

  /**
   * Send text input (for testing)
   */
  sendTextInput(text: string): void {
    this.send({
      type: 'text_input',
      data: { text },
    });
  }

  /**
   * End the session
   */
  endSession(): void {
    this.send({
      type: 'end_session',
      data: {},
    });
  }

  /**
   * Get session status
   */
  getStatus(): void {
    this.send({
      type: 'get_status',
      data: {},
    });
  }

  /**
   * Send message to server
   */
  private send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Close connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Event handlers
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter((h) => h !== handler);
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.push(handler);
    return () => {
      this.connectHandlers = this.connectHandlers.filter((h) => h !== handler);
    };
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.push(handler);
    return () => {
      this.disconnectHandlers = this.disconnectHandlers.filter((h) => h !== handler);
    };
  }
}

/**
 * Create WebSocket connection for a session
 */
export function createConversationSocket(sessionId: string): ConversationWebSocket {
  return new ConversationWebSocket(sessionId);
}
