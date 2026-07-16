import { useEffect, useState } from 'react'
import { getActiveBusinessProfile, updateBusinessProfile } from '../../lib/api'
import SettingsTabs from './SettingsTabs'

const TONES = [
  { value: 'friendly-professional', label: 'Friendly & professional' },
  { value: 'formal', label: 'Formal' },
  { value: 'warm-casual', label: 'Warm & casual' },
  { value: 'concise-direct', label: 'Concise & direct' },
]

const AFTER_HOURS = [
  { value: 'voicemail', label: 'Send to voicemail' },
  { value: 'ai_handle', label: 'Let the AI handle it' },
  { value: 'forward', label: 'Forward to another number' },
]

export default function BusinessProfileSettings() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getActiveBusinessProfile()
      .then((p) => {
        setProfile(p)
        setForm(p)
      })
      .catch((e) => setError(e.message))
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateBusinessProfile(profile.id, {
        name: form.name,
        industry: form.industry,
        greeting_script: form.greeting_script,
        tone: form.tone,
        timezone: form.timezone,
        after_hours_action: form.after_hours_action,
        forward_number: form.forward_number || null,
        is_active: form.is_active,
      })
      setProfile(updated)
      setForm(updated)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-xl text-ink mb-1">Business profile</h1>
      <p className="text-sm text-ink-faint mb-6">
        This drives everything the AI says and how it behaves — no code changes needed to reconfigure for a new client.
      </p>

      <SettingsTabs />

      {error && <p className="text-sm text-signal mb-4">{error}</p>}
      {!form ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="panel p-5 space-y-5 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Business name</label>
              <input className="field-input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Industry</label>
              <input className="field-input" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Greeting script</label>
            <textarea
              className="field-textarea"
              rows={3}
              value={form.greeting_script}
              onChange={(e) => set('greeting_script', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Tone / personality</label>
              <select className="field-input" value={form.tone} onChange={(e) => set('tone', e.target.value)}>
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Timezone</label>
              <input className="field-input" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">After-hours handling</label>
              <select
                className="field-input"
                value={form.after_hours_action}
                onChange={(e) => set('after_hours_action', e.target.value)}
              >
                {AFTER_HOURS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            {form.after_hours_action === 'forward' && (
              <div>
                <label className="field-label">Forward-to number</label>
                <input
                  className="field-input"
                  value={form.forward_number || ''}
                  onChange={(e) => set('forward_number', e.target.value)}
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Profile is active (uncheck to pause the AI receptionist for this business)
          </label>

          <div className="flex items-center gap-3 pt-2 border-t border-line">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-ok">Saved</span>}
          </div>
        </form>
      )}
    </div>
  )
}
