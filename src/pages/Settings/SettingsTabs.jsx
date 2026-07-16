import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/settings/profile', label: 'Business profile' },
  { to: '/settings/rules', label: 'Handling rules' },
  { to: '/settings/faqs', label: 'FAQs' },
]

export default function SettingsTabs() {
  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive ? 'border-signal text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
