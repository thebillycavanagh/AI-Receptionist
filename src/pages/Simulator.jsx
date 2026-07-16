import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getActiveBusinessProfile } from '../lib/api'
import ClassificationBadge from '../components/ClassificationBadge'

export default function Simulator() {
  const [profile, setProfile] = useState(null)
  const [channel, setChannel] = useState('text')
  const [callerNumber, setCallerNumber] = useState('+1 555 010 1234')
  const [callerName, setCallerName] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getActiveBusinessProfile().then(setProfile).catch((e) => setError(e.message))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessProfileId: profile.id,
          channel,
          callerNumber,
          callerName: callerName || undefined,
          message,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-xl text-ink mb-1">Simulator</h1>
      <p className="text-sm text-ink-faint mb-6">
        Send a test call or text through the current business profile's rules, tone, and FAQs —
        without waiting on a real caller. Results are written to the Inbox like any other contact.
      </p>

      <form onSubmit={handleSubmit} className="panel p-5 space-y-4">
        <div className="flex gap-4">
          <div className="w-32">
            <label className="field-label">Channel</label>
            <select className="field-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="text">Text</option>
              <option value="call">Call</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="field-label">Caller number</label>
            <input className="field-input" value={callerNumber} onChange={(e) => setCallerNumber(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="field-label">Caller name (optional)</label>
            <input className="field-input" value={callerName} onChange={(e) => setCallerName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="field-label">{channel === 'text' ? 'Text message' : 'Call transcript'}</label>
          <textarea
            className="field-textarea"
            rows={4}
            required
            placeholder="e.g. Hi, do you have any openings this Thursday afternoon for a haircut?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading || !profile} className="btn-primary">
          {loading ? 'Classifying…' : 'Run through AI receptionist'}
        </button>
        {error && <p className="text-sm text-signal">{error}</p>}
      </form>

      {result && (
        <div className="panel p-5 mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <ClassificationBadge value={result.classification} />
            <span className="text-xs text-ink-faint font-mono">
              {result.ai_confidence != null ? `${Math.round(result.ai_confidence * 100)}% confidence` : ''}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">Reason</p>
            <p className="text-sm text-ink-soft">{result.reason}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">Summary</p>
            <p className="text-sm text-ink-soft">{result.summary}</p>
          </div>
          {result.draft_reply && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">
                What the AI would say/text back
              </p>
              <p className="text-sm text-ink-soft italic">&ldquo;{result.draft_reply}&rdquo;</p>
            </div>
          )}
          <p className="text-xs text-ink-faint pt-2 border-t border-line">
            Logged to the Inbox with status "{result.status}".
          </p>
        </div>
      )}
    </div>
  )
}
