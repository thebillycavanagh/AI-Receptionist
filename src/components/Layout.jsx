import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Inbox', end: true },
  { to: '/simulator', label: 'Simulator' },
  { to: '/settings/profile', label: 'Business Profile' },
  { to: '/settings/rules', label: 'Handling Rules' },
  { to: '/settings/faqs', label: 'FAQs' },
]

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-display text-lg tracking-tight text-ink">
              Front Desk<span className="text-signal">.</span>
            </span>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-ink text-paper'
                        : 'text-ink-soft hover:bg-mute-soft'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-ink-faint font-mono">{user?.email}</span>
            <button onClick={signOut} className="btn-secondary text-xs">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
