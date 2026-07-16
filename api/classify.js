import { createClient } from '@supabase/supabase-js'
import { classifyAndLog } from './_lib/classify.js'

// POST /api/classify
// Body: { businessProfileId, channel, callerNumber, callerName, message }
// Requires a valid Supabase session (the logged-in admin) — this is the
// endpoint the in-app Simulator page uses to test rules/tone/FAQs without
// waiting for a real phone call or text to come in.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' })
    return
  }

  const authClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }

  const { businessProfileId, channel, callerNumber, callerName, message } = req.body || {}
  if (!businessProfileId || !channel || !message) {
    res.status(400).json({ error: 'businessProfileId, channel, and message are required' })
    return
  }

  try {
    const result = await classifyAndLog({
      businessProfileId,
      channel,
      callerNumber: callerNumber || 'unknown',
      callerName,
      message,
    })
    res.status(200).json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Classification failed' })
  }
}
