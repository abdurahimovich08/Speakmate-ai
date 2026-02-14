/* ===========================
   Telegram WebApp SDK wrapper
   =========================== */

import type { TelegramUser } from '../types'

// Telegram WebApp global type
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    auth_date?: number
    hash?: string
    query_id?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number

  ready(): void
  expand(): void
  close(): void

  // Main Button
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    show(): void
    hide(): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
    setText(text: string): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
    setParams(params: Record<string, string | boolean>): void
  }

  // Back Button
  BackButton: {
    isVisible: boolean
    show(): void
    hide(): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
  }

  // Haptic Feedback
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }

  showAlert(message: string, callback?: () => void): void
  showConfirm(message: string, callback?: (ok: boolean) => void): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
}

class TelegramService {
  private _webapp: TelegramWebApp | null = null

  get webapp(): TelegramWebApp | null {
    if (!this._webapp && window.Telegram?.WebApp) {
      this._webapp = window.Telegram.WebApp
    }
    return this._webapp
  }

  get isAvailable(): boolean {
    return !!this.webapp
  }

  get initData(): string {
    return this.webapp?.initData || ''
  }

  get user(): TelegramUser | null {
    return this.webapp?.initDataUnsafe?.user || null
  }

  get colorScheme(): 'light' | 'dark' {
    return this.webapp?.colorScheme || 'light'
  }

  get platform(): string {
    return this.webapp?.platform || 'unknown'
  }

  get viewportStableHeight(): number {
    return this.webapp?.viewportStableHeight || window.innerHeight
  }

  /** Call once on app boot */
  init() {
    if (!this.webapp) return
    this.webapp.ready()
    this.webapp.expand()
    this.webapp.enableClosingConfirmation()

    // Apply theme colors
    this._applyTheme()
  }

  /** Listen for theme changes (Telegram dark/light mode toggle) */
  onThemeChange(callback: (scheme: 'light' | 'dark') => void): () => void {
    if (!this.webapp) return () => {}
    const handler = () => callback(this.webapp!.colorScheme)
    // Telegram dispatches a custom event when theme changes
    window.addEventListener('themeChanged', handler)
    return () => window.removeEventListener('themeChanged', handler)
  }

  /** Share content using Telegram's native sharing */
  share(text: string) {
    if (this.webapp) {
      // Use Telegram's built-in share via sendData or switching to inline
      const url = `https://t.me/share/url?text=${encodeURIComponent(text)}`
      window.open(url, '_blank')
    }
  }

  private _applyTheme() {
    if (!this.webapp) return
    try {
      const bg = this.webapp.themeParams?.bg_color
      if (bg) {
        this.webapp.setBackgroundColor(bg)
        this.webapp.setHeaderColor(bg)
      }
    } catch {
      // older clients may not support these
    }
  }

  // ---- Main Button ----
  showMainButton(text: string, onClick: () => void) {
    if (!this.webapp) return
    this.webapp.MainButton.setText(text)
    this.webapp.MainButton.onClick(onClick)
    this.webapp.MainButton.show()
  }

  hideMainButton() {
    this.webapp?.MainButton.hide()
  }

  setMainButtonLoading(loading: boolean) {
    if (!this.webapp) return
    if (loading) {
      this.webapp.MainButton.showProgress()
    } else {
      this.webapp.MainButton.hideProgress()
    }
  }

  // ---- Back Button ----
  showBackButton(onClick: () => void) {
    if (!this.webapp) return
    this.webapp.BackButton.onClick(onClick)
    this.webapp.BackButton.show()
  }

  hideBackButton() {
    this.webapp?.BackButton.hide()
  }

  // ---- Haptic ----
  hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
    this.webapp?.HapticFeedback.impactOccurred(style)
  }

  hapticNotification(type: 'success' | 'error' | 'warning') {
    this.webapp?.HapticFeedback.notificationOccurred(type)
  }

  hapticSelection() {
    this.webapp?.HapticFeedback.selectionChanged()
  }

  // ---- Dialogs ----
  alert(message: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.webapp) {
        this.webapp.showAlert(message, resolve)
      } else {
        window.alert(message)
        resolve()
      }
    })
  }

  confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.webapp) {
        this.webapp.showConfirm(message, (ok) => resolve(ok))
      } else {
        resolve(window.confirm(message))
      }
    })
  }

  close() {
    this.webapp?.close()
  }
}

export const telegramService = new TelegramService()
