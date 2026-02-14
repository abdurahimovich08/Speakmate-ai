/* ===========================
   useAudio hook — microphone recording for sessions
   =========================== */

import { useRef, useCallback, useState } from 'react'
import { AudioRecorder, isAudioSupported, requestMicPermission } from '../services/audio'
import { useSessionStore } from '../stores/sessionStore'

export function useAudio() {
  const recorderRef = useRef<AudioRecorder | null>(null)
  const startingRef = useRef(false)
  const [recording, setRecording] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const socket = useSessionStore((s) => s.socket)

  const checkPermission = useCallback(async () => {
    if (!isAudioSupported()) {
      setPermissionGranted(false)
      return false
    }
    const granted = await requestMicPermission()
    setPermissionGranted(granted)
    return granted
  }, [])

  const startRecording = useCallback(async () => {
    if (!socket || recording || startingRef.current) return
    startingRef.current = true

    const recorder = new AudioRecorder((base64, isFinal, mimeType) => {
      socket.sendAudioChunk(base64, isFinal, mimeType)
    }, 3000)

    try {
      // Single getUserMedia request is performed inside recorder.start().
      // This avoids double permission prompts in Telegram WebView.
      await recorder.start()
      recorderRef.current = recorder
      setPermissionGranted(true)
      setRecording(true)
      useSessionStore.getState().setRecording(true)
    } catch {
      setPermissionGranted(false)
      recorderRef.current = null
      setRecording(false)
      useSessionStore.getState().setRecording(false)
      throw new Error('Microphone access denied or unavailable')
    } finally {
      startingRef.current = false
    }
  }, [socket, recording])

  const stopRecording = useCallback(async () => {
    if (startingRef.current) return
    await recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    useSessionStore.getState().setRecording(false)
  }, [])

  const toggleRecording = useCallback(async () => {
    if (recording) {
      await stopRecording()
    } else {
      await startRecording()
    }
  }, [recording, startRecording, stopRecording])

  return {
    recording,
    permissionGranted,
    startRecording,
    stopRecording,
    toggleRecording,
    checkPermission,
    isSupported: isAudioSupported(),
  }
}
