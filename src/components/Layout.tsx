import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', icon: '🍎' },
  { to: '/workouts', label: 'Train', icon: '🏋' },
  { to: '/trends', label: 'Trends', icon: '📈' },
  { to: '/supplements', label: 'Supps', icon: '💊' },
  { to: '/profile', label: 'Profile', icon: '⚙️' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 px-4 pb-28 pt-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-base-border bg-base-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition ${
                  isActive ? 'text-accent' : 'text-slate-400'
                }`
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
