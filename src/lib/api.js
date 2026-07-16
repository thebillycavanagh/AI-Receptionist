import { supabase } from './supabaseClient'

// V1 is single-tenant per deployment: either the profile id is pinned via
// env, or we fall back to whichever profile the logged-in owner has.
// Everything below stays scoped to a business_profile_id so the same
// functions work unmodified once a deployment serves multiple tenants.
const PINNED_PROFILE_ID = import.meta.env.VITE_BUSINESS_PROFILE_ID || null

export async function getActiveBusinessProfile() {
  if (PINNED_PROFILE_ID) {
    const { data, error } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('id', PINNED_PROFILE_ID)
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateBusinessProfile(id, updates) {
  const { data, error } = await supabase
    .from('business_profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- FAQ entries ----------------------------------------------------------

export async function listFaqEntries(businessProfileId) {
  const { data, error } = await supabase
    .from('faq_entries')
    .select('*')
    .eq('business_profile_id', businessProfileId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function upsertFaqEntry(entry) {
  const { data, error } = await supabase
    .from('faq_entries')
    .upsert(entry)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFaqEntry(id) {
  const { error } = await supabase.from('faq_entries').delete().eq('id', id)
  if (error) throw error
}

// ---- Handling rules ---------------------------------------------------

export async function listHandlingRules(businessProfileId) {
  const { data, error } = await supabase
    .from('handling_rules')
    .select('*')
    .eq('business_profile_id', businessProfileId)
    .order('priority', { ascending: true })
  if (error) throw error
  return data
}

export async function upsertHandlingRule(rule) {
  const { data, error } = await supabase
    .from('handling_rules')
    .upsert(rule)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHandlingRule(id) {
  const { error } = await supabase.from('handling_rules').delete().eq('id', id)
  if (error) throw error
}

// ---- Call logs --------------------------------------------------------

export async function listCallLogs(businessProfileId, filters = {}) {
  let query = supabase
    .from('call_logs')
    .select('*')
    .eq('business_profile_id', businessProfileId)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.classification) query = query.eq('classification', filters.classification)
  if (filters.channel) query = query.eq('channel', filters.channel)
  if (filters.search) {
    query = query.or(
      `caller_name.ilike.%${filters.search}%,caller_number.ilike.%${filters.search}%,summary.ilike.%${filters.search}%,reason.ilike.%${filters.search}%`,
    )
  }
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function updateCallLogStatus(id, status) {
  const { data, error } = await supabase
    .from('call_logs')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Used by the Simulator page to create a test call/text without going
// through the real telephony webhook.
export async function insertCallLog(entry) {
  const { data, error } = await supabase
    .from('call_logs')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data
}
