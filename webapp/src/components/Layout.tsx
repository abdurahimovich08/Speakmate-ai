/* ===========================
   Layout - Telegram-theme-aware shell with tab navigation
   =========================== */

import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', icon: 'H', label: 'Home' },
  { to: '/coach', icon: 'C', label: 'Coach' },
  { to: '/practice', icon: 'P', label: 'Practice' },
  { to: '/history', icon: 'R', label: 'History' },
  { to: '/profile', icon: 'U', label: 'Profile' },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-tg-bg text-tg-text">
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-tg-section border-t border-tg-secondary flex z-50">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                isActive ? 'text-tg-button' : 'text-tg-hint'
              }`
            }
          >
            <span className="text-lg font-semibold">{tab.icon}</span>
            <span className="mt-0.5">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
