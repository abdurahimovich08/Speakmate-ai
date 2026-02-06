/* ===========================
   Profile — User profile & settings
   =========================== */

import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { getUserStats, updateProfile } from '../services/api'
import { telegramService } from '../services/telegram'

const bandOptions = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]
const languageOptions = [
  { value: 'uz', label: "O'zbek" },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

export default function Profile() {
  useTelegramBackButton(true)
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [targetBand, setTargetBand] = useState(user?.target_band || 7.0)
  const [nativeLang, setNativeLang] = useState(user?.native_language || 'uz')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getUserStats().then(setStats).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({ target_band: targetBand, native_language: nativeLang })
      telegramService.hapticNotification('success')
    } catch {
      telegramService.hapticNotification('error')
    }
    setSaving(false)
  }

  const tgUser = telegramService.user

  return (
    <div className="p-4 animate-fade-in">
      {/* Avatar & Name */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto bg-tg-button text-tg-button-text rounded-full flex items-center justify-center text-3xl font-bold">
          {(user?.full_name || 'U')[0].toUpperCase()}
        </div>
        <h1 className="text-xl font-bold mt-3">{user?.full_name || tgUser?.first_name || 'User'}</h1>
        {tgUser?.username && (
          <p className="text-sm text-tg-hint">@{tgUser.username}</p>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-tg-section rounded-xl p-3 text-center">
            <p className="text-xl font-bold">{String(stats.total_sessions || 0)}</p>
            <p className="text-xs text-tg-hint">Sessiyalar</p>
          </div>
          <div className="bg-tg-section rounded-xl p-3 text-center">
            <p className="text-xl font-bold">{String(stats.total_practice_minutes || 0)}m</p>
            <p className="text-xs text-tg-hint">Mashq vaqti</p>
          </div>
          <div className="bg-tg-section rounded-xl p-3 text-center">
            <p className="text-xl font-bold">{String(stats.average_band || '—')}</p>
            <p className="text-xs text-tg-hint">O'rtacha band</p>
          </div>
        </div>
      )}

      {/* Settings */}
      <h2 className="font-semibold mb-3 text-tg-section-header text-sm uppercase">
        Sozlamalar
      </h2>

      <div className="bg-tg-section rounded-xl divide-y divide-tg-secondary">
        {/* Target band */}
        <div className="p-4">
          <label className="text-sm font-medium">🎯 Maqsad Band</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {bandOptions.map((b) => (
              <button
                key={b}
                onClick={() => {
                  setTargetBand(b)
                  telegramService.hapticSelection()
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  targetBand === b
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary text-tg-text'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Native language */}
        <div className="p-4">
          <label className="text-sm font-medium">🌐 Ona tili</label>
          <div className="flex gap-2 mt-2">
            {languageOptions.map((lang) => (
              <button
                key={lang.value}
                onClick={() => {
                  setNativeLang(lang.value)
                  telegramService.hapticSelection()
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  nativeLang === lang.value
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary text-tg-text'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-4 py-3 rounded-xl bg-tg-button text-tg-button-text font-semibold active:scale-[0.98] transition-transform"
      >
        {saving ? '⏳ Saqlanmoqda...' : '💾 Saqlash'}
      </button>

      {/* App info */}
      <div className="mt-8 text-center text-xs text-tg-hint">
        <p>SpeakMate AI v1.0.0</p>
        <p>Platform: {telegramService.platform}</p>
      </div>
    </div>
  )
}
