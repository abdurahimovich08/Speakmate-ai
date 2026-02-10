/* ===========================
   Layout - Telegram-theme-aware shell with tab navigation
   =========================== */

import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/coach', label: 'Coach', Icon: SparkIcon },
  { to: '/practice', label: 'Practice', Icon: MicIcon },
  { to: '/history', label: 'History', Icon: ClockIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-sm-bg text-sm-text font-ui">
      <main className="flex-1 pb-24 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 sm-safe-bottom">
        <div className="mx-auto max-w-md sm-nav border border-sm-border shadow-smglow rounded-smxl">
          <div className="grid grid-cols-5">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center py-3 text-[11px] transition-colors ${
                    isActive ? 'text-sm-accent' : 'text-sm-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`mb-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl transition-transform ${
                        isActive ? 'bg-sm-card2 scale-[1.02]' : 'bg-transparent'
                      }`}
                    >
                      <tab.Icon active={isActive} />
                    </span>
                    <span className="font-medium tracking-tight">{tab.label}</span>
                    {isActive && (
                      <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-sm-accent" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? 'text-sm-accent' : 'text-sm-muted'}
    >
      <path
        d="M3 11.2L12 4l9 7.2V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-8.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 21.5V14.4a1.2 1.2 0 0 1 1.2-1.2h3.2a1.2 1.2 0 0 1 1.2 1.2v7.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? 'text-sm-accent' : 'text-sm-muted'}
    >
      <path
        d="M12 2l1.2 6.2L20 12l-6.8 3.8L12 22l-1.2-6.2L4 12l6.8-3.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? 'text-sm-accent' : 'text-sm-muted'}
    >
      <path
        d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V7.5A3.5 3.5 0 0 0 12 4a3.5 3.5 0 0 0-3.5 3.5V11a3.5 3.5 0 0 0 3.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 11.2c0 3.6 2.9 6.3 6.5 6.3s6.5-2.7 6.5-6.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? 'text-sm-accent' : 'text-sm-muted'}
    >
      <path
        d="M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7v5.2l3.6 2.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? 'text-sm-accent' : 'text-sm-muted'}
    >
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.6 21.2c1.7-3.6 4.5-5.2 7.4-5.2s5.7 1.6 7.4 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
