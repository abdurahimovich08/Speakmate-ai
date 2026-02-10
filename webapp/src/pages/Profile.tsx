/* ===========================
   Profile - Premium profile & settings
   =========================== */

import { useEffect, useMemo, useState } from 'react'
import { useTelegramBackButton } from '../hooks/useTelegram'
import { useAuthStore } from '../stores/authStore'
import { getUserStats, updateProfile } from '../services/api'
import { telegramService } from '../services/telegram'
import { Button } from '../components/ui/Button'
import { Card, SoftCard } from '../components/ui/Card'

const bandOptions = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]
const languageOptions = [
  { value: 'uz', label: "O'zbek" },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

export default function Profile() {
  useTelegramBackButton(true)

  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [targetBand, setTargetBand] = useState(user?.target_band || 7.0)
  const [nativeLang, setNativeLang] = useState(user?.native_language || 'uz')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getUserStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    setFullName(user?.full_name || '')
    setTargetBand(user?.target_band || 7.0)
    setNativeLang(user?.native_language || 'uz')
  }, [user?.full_name, user?.target_band, user?.native_language])

  const tgUser = telegramService.user
  const displayName = (fullName || user?.full_name || tgUser?.first_name || 'User').trim()
  const initials = useMemo(() => {
    const parts = displayName.split(' ').filter(Boolean)
    const a = parts[0]?.[0] || 'U'
    const b = parts[1]?.[0] || ''
    return `${a}${b}`.toUpperCase()
  }, [displayName])

  const totalSessions = safeNumber(stats?.total_sessions) ?? 0
  const totalMinutes = safeNumber(stats?.total_practice_minutes) ?? 0
  const avgBand = safeNumber(stats?.average_band)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateProfile({
        full_name: fullName.trim() || undefined,
        target_band: targetBand,
        native_language: nativeLang,
      })
      useAuthStore.setState({ user: updated })
      telegramService.hapticNotification('success')
    } catch (e) {
      console.error(e)
      telegramService.hapticNotification('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 animate-fade-in font-ui">
      <Card className="p-4 mb-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-r from-sm-energy via-transparent to-sm-accent" />
        <div className="relative flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-semibold font-display text-white"
            style={{ background: 'linear-gradient(135deg, var(--sm-accent), var(--sm-energy-2), var(--sm-energy))' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Profile</p>
            <h1 className="text-xl font-semibold tracking-tight truncate">{displayName}</h1>
            {tgUser?.username && (
              <p className="text-xs text-sm-muted mt-1 truncate">@{tgUser.username}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <SoftCard className="p-3 text-center">
          <p className="text-[11px] text-sm-muted uppercase tracking-widest">Sessions</p>
          <p className="text-lg font-semibold mt-1 tabular-nums">{totalSessions}</p>
        </SoftCard>
        <SoftCard className="p-3 text-center">
          <p className="text-[11px] text-sm-muted uppercase tracking-widest">Minutes</p>
          <p className="text-lg font-semibold mt-1 tabular-nums">{totalMinutes}m</p>
        </SoftCard>
        <SoftCard className="p-3 text-center">
          <p className="text-[11px] text-sm-muted uppercase tracking-widest">Avg band</p>
          <p className="text-lg font-semibold mt-1 tabular-nums">{avgBand != null ? avgBand.toFixed(1) : '—'}</p>
        </SoftCard>
      </div>

      <Card className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Settings</p>
        <h2 className="text-lg font-semibold font-display mt-1">Coach setup</h2>
        <p className="text-xs text-sm-muted mt-2 leading-relaxed">
          Bu sozlamalar Daily Mission va tavsiyalarni shaxsiylashtiradi. Maqsadni aniq qo'ysangiz, coach yanada premium ishlaydi.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium tracking-tight">Ism</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masalan: Abdurahim"
              className="mt-2 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm outline-none focus:border-sm-accent focus-visible:ring-2 focus-visible:ring-[color:var(--sm-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium tracking-tight">Maqsad band</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {bandOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setTargetBand(b)
                    telegramService.hapticSelection()
                  }}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold tabular-nums border border-sm-border transition-colors ${
                    targetBand === b ? 'bg-tg-button text-tg-button-text' : 'bg-sm-card2 text-sm-text'
                  }`}
                >
                  {b.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium tracking-tight">Ona tili</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {languageOptions.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => {
                    setNativeLang(lang.value)
                    telegramService.hapticSelection()
                  }}
                  className={`py-3 rounded-xl text-sm font-semibold border border-sm-border transition-colors ${
                    nativeLang === lang.value ? 'bg-tg-button text-tg-button-text' : 'bg-sm-card2 text-sm-text'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => logout()} disabled={saving}>
              Logout
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-6 text-center text-[11px] text-sm-muted">
        <p>SpeakMate AI v1.0.0</p>
        <p>Platform: {telegramService.platform}</p>
      </div>
    </div>
  )
}
