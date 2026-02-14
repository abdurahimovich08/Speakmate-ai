/* ===========================
   Toast notification system
   =========================== */

import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  duration: number
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

let _nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = ++_nextId
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600/90 text-white',
  error: 'bg-red-600/90 text-white',
  warning: 'bg-yellow-500/90 text-black',
  info: 'bg-sm-card text-sm-text border border-white/10',
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const hideTimer = setTimeout(() => setExiting(true), toast.duration - 300)
    const removeTimer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(removeTimer)
    }
  }, [toast, onDismiss])

  return (
    <div
      className={`
        pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg
        flex items-center gap-2 transition-all duration-300
        ${typeStyles[toast.type]}
        ${exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
      `}
    >
      <span className="text-base flex-shrink-0">{typeIcons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-60 hover:opacity-100 text-xs ml-2"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
