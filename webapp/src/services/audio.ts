/* ===========================
   Browser Audio Recording Service
   Uses MediaRecorder API for capturing audio from microphone.
   =========================== */

type AudioDataCallback = (base64: string, isFinal: boolean, mimeType?: string) => void

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private onData: AudioDataCallback
  private timeslice: number
  private stopResolver: (() => void) | null = null

  /**
   * @param onData  Called with base64 audio data every timeslice ms
   * @param timeslice  How often to emit chunks (ms). Use 0 to emit only once on stop.
   */
  constructor(onData: AudioDataCallback, timeslice = 0) {
    this.onData = onData
    this.timeslice = timeslice
  }

  /** Request microphone access and start recording */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 1,
      },
    })

    // Prefer opus/webm which Google STT supports natively
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm'

    // Keep audio payloads small so WebSocket messages don't hit size limits on mobile networks.
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: 48000,
    })

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
        // Streaming partial WebM chunks is unreliable across browsers/servers (often missing headers),
        // so by default we only send one final blob on stop.
        if (this.timeslice > 0) {
          const base64 = await this.blobToBase64(event.data)
          this.onData(base64, false, this.mediaRecorder?.mimeType)
        }
      }
    }

    this.mediaRecorder.onstop = async () => {
      // Send final chunk (combine all remaining)
      if (this.chunks.length > 0) {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType })
        const base64 = await this.blobToBase64(blob)
        this.onData(base64, true, this.mediaRecorder?.mimeType)
        this.chunks = []
      }
      if (this.stopResolver) {
        this.stopResolver()
        this.stopResolver = null
      }
    }

    if (this.timeslice > 0) {
      this.mediaRecorder.start(this.timeslice)
    } else {
      this.mediaRecorder.start()
    }
  }

  /** Stop recording and release the microphone */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder
      if (recorder && recorder.state !== 'inactive') {
        this.stopResolver = resolve
        recorder.stop()
      } else {
        resolve()
      }

      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop())
        this.stream = null
      }
    })
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  /** Convert Blob to base64 string */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        // result is "data:<mime>;base64,XXXX" — we want just the XXXX part
        const result = reader.result as string
        const base64 = result.split(',')[1] || ''
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
}

/** Check if browser supports audio recording */
export function isAudioSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

/** Request microphone permission and return whether granted */
export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}
