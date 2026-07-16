import { useEffect, useMemo, useState } from 'react'
import { getActiveBusinessProfile, listCallLogs, updateCallLogStatus } from '../lib/api'
import ClassificationBadge from '../components/ClassificationBadge'
import StatusBadge from '../components/StatusBadge'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'needs_follow_up', label: 'Needs follow-up' },
  { value: 'resolved', label: 'Resolved' },
]

const CLASSIFICATION_FILTERS = [
  { value: '', label: 'All classifications' },
  { value: 'legitimate_inquiry', label: 'Legitimate inquiry' },
  { value: 'existing_contact', label: 'Existing contact' },
  { value: 'spam', label: 'Spam' },
  { value: 'wrong_number', label: 'Wrong number' },
]

export default function Inbox() {
  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [classification, setClassification] = useState('')
  const [search, setSearch] = useState('')
  const [hideSpam, setHideSpam] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getActiveBusinessProfile().then(setProfile).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!profile) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, status, classification])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await listCallLogs(profile.id, {
        status: status || undefined,
        classification: classification || undefined,
        search: search || undefined,
      })
      setLogs(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const visibleLogs = useMemo(() => {
    if (!hideSpam) return logs
    return logs.filter((l) => l.classification !== 'spam' || status === 'resolved' || classification === 'spam')
  }, [logs, hideSpam, status, classification])

  async function handleStatusChange(id, newStatus) {
    const updated = await updateCallLogStatus(id, newStatus)
    setLogs((prev) => prev.map((l) => (l.id === id ? updated : l)))
    if (selected?.id === id) setSelected(updated)
  }

  if (error) {
    return <p className="text-sm text-signal">{error}</p>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-xl text-ink">Inbox</h1>
            <p className="text-sm text-ink-faint">
              {profile ? `Calls and texts handled for ${profile.name}` : 'Loading business profile…'}
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              refresh()
            }}
            className="flex items-center gap-2"
          >
            <input
              className="field-input w-56"
              placeholder="Search name, number, summary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-secondary">Search</button>
          </form>
        </div>

        <div className="flex items-center gap-3 mb-4 text-sm">
          <select className="field-input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select className="field-input w-auto" value={classification} onChange={(e) => setClassification(e.target.value)}>
            {CLASSIFICATION_FILTERS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-ink-soft ml-auto">
            <input type="checkbox" checked={hideSpam} onChange={(e) => setHideSpam(e.target.checked)} />
            Hide spam by default
          </label>
        </div>

        <div className="panel divide-y divide-line overflow-hidden">
          {loading && <p className="p-4 text-sm text-ink-faint">Loading…</p>}
          {!loading && visibleLogs.length === 0 && (
            <p className="p-8 text-sm text-ink-faint text-center">
              Nothing here yet. Incoming calls and texts will show up as they're handled.
            </p>
          )}
          {!loading &&
            visibleLogs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelected(log)}
                className={`w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-mute-soft transition-colors ${
                  selected?.id === log.id ? 'bg-mute-soft' : ''
                }`}
              >
                <div className="w-24 shrink-0 text-xs font-mono text-ink-faint">
                  {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  <br />
                  {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink truncate">
                      {log.caller_name || log.caller_number || 'Unknown caller'}
                    </span>
                    {log.urgency === 'high' && (
                      <span className="text-xs font-medium text-signal">Urgent</span>
                    )}
                  </div>
                  <p className="text-sm text-ink-faint truncate">{log.summary || log.reason || '—'}</p>
                </div>
                <ClassificationBadge value={log.classification} />
                <StatusBadge value={log.status} />
              </button>
            ))}
        </div>
      </div>

      <div className="panel p-5 h-fit sticky top-8">
        {!selected ? (
          <p className="text-sm text-ink-faint">Select an item to see full details.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">Caller</p>
              <p className="text-sm font-medium text-ink">{selected.caller_name || 'Unknown'}</p>
              <p className="text-sm font-mono text-ink-faint">{selected.caller_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <ClassificationBadge value={selected.classification} />
              <StatusBadge value={selected.status} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">Reason</p>
              <p className="text-sm text-ink-soft">{selected.reason || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">AI summary</p>
              <p className="text-sm text-ink-soft">{selected.summary || '—'}</p>
            </div>
            {selected.draft_reply && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">
                  What the AI said/texted back
                </p>
                <p className="text-sm text-ink-soft italic">&ldquo;{selected.draft_reply}&rdquo;</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">Channel</p>
                <p className="text-ink-soft capitalize">{selected.channel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">Confidence</p>
                <p className="text-ink-soft">
                  {selected.ai_confidence != null ? `${Math.round(selected.ai_confidence * 100)}%` : '—'}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-line flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusChange(selected.id, 'needs_follow_up')}
                className="btn-danger"
                disabled={selected.status === 'needs_follow_up'}
              >
                Mark needs follow-up
              </button>
              <button
                onClick={() => handleStatusChange(selected.id, 'resolved')}
                className="btn-secondary"
                disabled={selected.status === 'resolved'}
              >
                Mark resolved
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
