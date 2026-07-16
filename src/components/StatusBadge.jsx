const STYLES = {
  new: 'border-ink-faint text-ink-soft',
  needs_follow_up: 'border-signal text-signal',
  resolved: 'border-ok text-ok',
}

const LABELS = {
  new: 'New',
  needs_follow_up: 'Needs follow-up',
  resolved: 'Resolved',
}

export default function StatusBadge({ value }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${STYLES[value] || ''}`}>
      {LABELS[value] || value}
    </span>
  )
}
