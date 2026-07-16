import { useEffect, useState } from 'react'
import { getActiveBusinessProfile, listFaqEntries, upsertFaqEntry, deleteFaqEntry } from '../../lib/api'
import SettingsTabs from './SettingsTabs'

function emptyEntry(businessProfileId) {
  return { business_profile_id: businessProfileId, question: '', answer: '', category: '', is_active: true }
}

export default function FaqSettings() {
  const [profile, setProfile] = useState(null)
  const [entries, setEntries] = useState([])
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getActiveBusinessProfile()
      .then((p) => {
        setProfile(p)
        return listFaqEntries(p.id).then(setEntries)
      })
      .catch((e) => setError(e.message))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const saved = await upsertFaqEntry(draft)
      setEntries((prev) => {
        const exists = prev.some((e) => e.id === saved.id)
        return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]
      })
      setDraft(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deleteFaqEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-xl text-ink mb-1">FAQ / knowledge base</h1>
      <p className="text-sm text-ink-faint mb-6">
        The AI pulls from these when answering inquiries — keep answers short and in the voice you want the receptionist to use.
      </p>

      <SettingsTabs />

      {error && <p className="text-sm text-signal my-4">{error}</p>}

      <div className="mt-4">
        {!draft ? (
          <button onClick={() => setDraft(emptyEntry(profile.id))} className="btn-secondary">
            + Add FAQ entry
          </button>
        ) : (
          <div className="panel p-5 space-y-4">
            <div>
              <label className="field-label">Question</label>
              <input
                className="field-input"
                value={draft.question}
                onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Answer</label>
              <textarea
                className="field-textarea"
                rows={3}
                value={draft.answer}
                onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Category (optional)</label>
              <input
                className="field-input w-56"
                value={draft.category || ''}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2 border-t border-line">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save entry'}
              </button>
              <button onClick={() => setDraft(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel divide-y divide-line mt-4">
        {entries.length === 0 && <p className="p-6 text-sm text-ink-faint">No FAQ entries yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{entry.question}</p>
              <p className="text-sm text-ink-soft mt-0.5">{entry.answer}</p>
              {entry.category && (
                <span className="inline-block mt-1.5 text-xs text-ink-faint font-mono">{entry.category}</span>
              )}
            </div>
            <button onClick={() => setDraft(entry)} className="btn-secondary text-xs shrink-0">Edit</button>
            <button onClick={() => handleDelete(entry.id)} className="btn-danger text-xs shrink-0">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
