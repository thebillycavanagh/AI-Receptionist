import { useEffect, useState } from 'react'
import { getActiveBusinessProfile, listHandlingRules, upsertHandlingRule, deleteHandlingRule } from '../../lib/api'
import SettingsTabs from './SettingsTabs'

const RULE_TYPES = [
  { value: 'route_to_voicemail', label: 'Route to voicemail if…', hint: 'e.g. after hours, or a specific keyword is mentioned' },
  { value: 'flag_as_spam', label: 'Flag as spam if…', hint: 'comma-separated number patterns to match against the caller ID' },
  { value: 'block_number', label: 'Block number', hint: 'comma-separated exact numbers to silently drop' },
  { value: 'allow_number', label: 'Always allow number', hint: 'comma-separated numbers that should never be flagged as spam' },
  { value: 'escalate_urgent', label: 'Escalate as urgent if…', hint: 'keywords that should mark a contact high-urgency' },
  { value: 'unknown_number_handling', label: 'Unknown number handling', hint: 'how to treat callers with no caller ID' },
]

function emptyRule(businessProfileId) {
  return {
    business_profile_id: businessProfileId,
    rule_type: 'flag_as_spam',
    rule_value: {},
    is_enabled: true,
    priority: 100,
  }
}

export default function HandlingRulesSettings() {
  const [profile, setProfile] = useState(null)
  const [rules, setRules] = useState([])
  const [draft, setDraft] = useState(null)
  const [rawValue, setRawValue] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getActiveBusinessProfile().then((p) => {
      setProfile(p)
      return listHandlingRules(p.id).then(setRules)
    }).catch((e) => setError(e.message))
  }, [])

  function startNew() {
    setDraft(emptyRule(profile.id))
    setRawValue('')
  }

  function editRule(rule) {
    setDraft(rule)
    setRawValue(ruleValueToText(rule))
  }

  function ruleValueToText(rule) {
    if (rule.rule_type === 'flag_as_spam') return (rule.rule_value?.patterns || []).join(', ')
    if (rule.rule_type === 'block_number') return (rule.rule_value?.numbers || []).join(', ')
    if (rule.rule_type === 'allow_number') return (rule.rule_value?.numbers || []).join(', ')
    if (rule.rule_type === 'escalate_urgent') return (rule.rule_value?.keywords || []).join(', ')
    if (rule.rule_type === 'route_to_voicemail') return rule.rule_value?.condition || ''
    if (rule.rule_type === 'unknown_number_handling') return rule.rule_value?.mode || 'treat_as_normal'
    return JSON.stringify(rule.rule_value || {})
  }

  function textToRuleValue(type, text) {
    const list = text.split(',').map((s) => s.trim()).filter(Boolean)
    switch (type) {
      case 'flag_as_spam': return { patterns: list }
      case 'block_number': return { numbers: list }
      case 'allow_number': return { numbers: list }
      case 'escalate_urgent': return { keywords: list }
      case 'route_to_voicemail': return { condition: text.trim() }
      case 'unknown_number_handling': return { mode: text.trim() || 'treat_as_normal' }
      default: return {}
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const toSave = { ...draft, rule_value: textToRuleValue(draft.rule_type, rawValue) }
      const saved = await upsertHandlingRule(toSave)
      setRules((prev) => {
        const exists = prev.some((r) => r.id === saved.id)
        return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]
      })
      setDraft(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deleteHandlingRule(id)
    setRules((prev) => prev.filter((r) => r.id !== id))
    if (draft?.id === id) setDraft(null)
  }

  async function toggleEnabled(rule) {
    const updated = await upsertHandlingRule({ ...rule, is_enabled: !rule.is_enabled })
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-xl text-ink mb-1">Handling rules</h1>
      <p className="text-sm text-ink-faint mb-6">
        Deterministic rules run before the AI does — use them to hard-block known spam numbers or force
        specific routing, independent of what the model decides.
      </p>

      <SettingsTabs />

      {error && <p className="text-sm text-signal my-4">{error}</p>}

      <div className="panel divide-y divide-line mt-4">
        {rules.length === 0 && <p className="p-6 text-sm text-ink-faint">No rules configured yet.</p>}
        {rules.map((rule) => {
          const meta = RULE_TYPES.find((t) => t.value === rule.rule_type)
          return (
            <div key={rule.id} className="p-4 flex items-center gap-4">
              <label className="flex items-center">
                <input type="checkbox" checked={rule.is_enabled} onChange={() => toggleEnabled(rule)} />
              </label>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{meta?.label || rule.rule_type}</p>
                <p className="text-xs text-ink-faint truncate font-mono">{ruleValueToText(rule)}</p>
              </div>
              <span className="text-xs text-ink-faint font-mono">priority {rule.priority}</span>
              <button onClick={() => editRule(rule)} className="btn-secondary text-xs">Edit</button>
              <button onClick={() => handleDelete(rule.id)} className="btn-danger text-xs">Delete</button>
            </div>
          )
        })}
      </div>

      {!draft ? (
        <button onClick={startNew} className="btn-secondary mt-4">+ Add rule</button>
      ) : (
        <div className="panel p-5 mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Rule type</label>
              <select
                className="field-input"
                value={draft.rule_type}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, rule_type: e.target.value }))
                  setRawValue('')
                }}
              >
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Priority (lower runs first)</label>
              <input
                type="number"
                className="field-input"
                value={draft.priority}
                onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="field-label">
              Value — {RULE_TYPES.find((t) => t.value === draft.rule_type)?.hint}
            </label>
            <input className="field-input" value={rawValue} onChange={(e) => setRawValue(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-line">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save rule'}
            </button>
            <button onClick={() => setDraft(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
