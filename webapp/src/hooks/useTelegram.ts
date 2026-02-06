/* ===========================
   useTelegram hook
   =========================== */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { telegramService } from '../services/telegram'

/**
 * Hook to manage Telegram BackButton and other lifecycle.
 * @param showBack  Show the back button?
 */
export function useTelegramBackButton(showBack = true) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!telegramService.isAvailable) return

    const handleBack = () => navigate(-1)

    if (showBack) {
      telegramService.showBackButton(handleBack)
    } else {
      telegramService.hideBackButton()
    }

    return () => {
      telegramService.webapp?.BackButton.offClick(handleBack)
    }
  }, [showBack, navigate])
}

/**
 * Hook to manage Telegram MainButton.
 */
export function useTelegramMainButton(
  text: string,
  onClick: () => void,
  visible = true,
  loading = false,
) {
  useEffect(() => {
    if (!telegramService.isAvailable) return

    if (visible) {
      telegramService.showMainButton(text, onClick)
    } else {
      telegramService.hideMainButton()
    }

    return () => {
      telegramService.hideMainButton()
    }
  }, [text, onClick, visible])

  useEffect(() => {
    telegramService.setMainButtonLoading(loading)
  }, [loading])
}
