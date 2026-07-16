const STYLES = {
  legitimate_inquiry: 'bg-ok-soft text-ok',
  existing_contact: 'bg-mute-soft text-ink-soft',
  spam: 'bg-signal-soft text-signal',
  wrong_number: 'bg-warn-soft text-warn',
  unclassified: 'bg-mute-soft text-ink-faint',
}

const LABELS = {
  legitimate_inquiry: 'Legitimate inquiry',
  existing_contact: 'Existing contact',
  spam: 'Spam',
  wrong_number: 'Wrong number',
  unclassified: 'Unclassified',
}

export default function ClassificationBadge({ value }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${STYLES[value] || STYLES.unclassified}`}>
      {LABELS[value] || value}
    </span>
  )
}
