/* ===========================
   useAudio hook — microphone recording for sessions
   =========================== */

import { useRef, useCallback, useState } from 'react'
import { AudioRecorder, isAudioSupported, requestMicPermission } from '../services/audio'
import { useSessionStore } from '../stores/sessionStore'

export function useAudio() {
  const recorderRef = useRef<AudioRecorder | null>(null)
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
    if (!socket) return

    const ok = await checkPermission()
    if (!ok) return

    const recorder = new AudioRecorder((base64, isFinal) => {
      socket.sendAudioChunk(base64, isFinal)
    }, 3000)

    await recorder.start()
    recorderRef.current = recorder
    setRecording(true)
    useSessionStore.getState().setRecording(true)
  }, [socket, checkPermission])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    useSessionStore.getState().setRecording(false)
  }, [])

  const toggleRecording = useCallback(async () => {
    if (recording) {
      stopRecording()
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
