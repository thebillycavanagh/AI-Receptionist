import { classifyAndLog } from '../_lib/classify.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// POST /api/webhook/incoming
// Point your Twilio phone number's "A call comes in" AND "A message comes in"
// webhooks at this same URL:
//   https://<your-domain>/api/webhook/incoming?secret=<TELEPHONY_WEBHOOK_SECRET>
// (Twilio's webhook config doesn't support custom headers, so the shared
// secret travels as a query param instead — HTTPS keeps it off the wire.)
//
// Three request shapes land here:
//   1. SMS:                Twilio sends `Body` — classify, log, and text back.
//   2. Voice, call start:  Twilio sends `CallSid` with no `SpeechResult` yet —
//                          greet the caller and gather what they say.
//   3. Voice, after Gather: Twilio sends `CallSid` + `SpeechResult` (their
//                          transcribed speech) — classify, log, and speak a reply.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const secret = req.headers['x-webhook-secret'] || req.query?.secret
  if (!process.env.TELEPHONY_WEBHOOK_SECRET || secret !== process.env.TELEPHONY_WEBHOOK_SECRET) {
    res.status(401).send('Unauthorized')
    return
  }

  const businessProfileId = process.env.VITE_BUSINESS_PROFILE_ID
  if (!businessProfileId) {
    res.status(500).send('Server is not configured with VITE_BUSINESS_PROFILE_ID')
    return
  }

  const body = req.body || {}

  // ---- 1. SMS ----------------------------------------------------------
  if (body.Body !== undefined) {
    await classifyAndRespond(res, {
      businessProfileId,
      channel: 'text',
      callerNumber: body.From || 'unknown',
      message: body.Body || '',
    }, smsTwiml)
    return
  }

  // ---- 2. Voice: call just connected, nothing said yet ------------------
  if (body.CallSid && body.SpeechResult === undefined) {
    try {
      const supabase = getSupabaseAdmin()
      const { data: profile, error } = await supabase
        .from('business_profiles')
        .select('greeting_script')
        .eq('id', businessProfileId)
        .single()
      if (error || !profile) throw error || new Error('Business profile not found')

      respondXml(res, voiceGatherTwiml(profile.greeting_script, req))
    } catch (err) {
      console.error(err)
      respondXml(res, voiceFallbackTwiml())
    }
    return
  }

  // ---- 3. Voice: caller has spoken (Gather result) -----------------------
  if (body.CallSid && body.SpeechResult !== undefined) {
    await classifyAndRespond(res, {
      businessProfileId,
      channel: 'call',
      callerNumber: body.From || 'unknown',
      message: body.SpeechResult || '(caller did not say anything understandable)',
    }, voiceReplyTwiml)
    return
  }

  // ---- Fallback: some other provider's payload shape ---------------------
  const { channel, callerNumber, message } = parseGenericPayload(body)
  if (!message) {
    res.status(400).send('No message/transcript content in payload')
    return
  }
  await classifyAndRespond(res, { businessProfileId, channel, callerNumber, message }, () => emptyTwiml())
}

// Runs the shared classify+log pipeline, then turns the result into TwiML.
// Spam/wrong-number contacts get an empty (silent) response — we don't
// engage them — everything else gets the AI's drafted reply.
async function classifyAndRespond(res, input, toTwiml) {
  try {
    const result = await classifyAndLog(input)
    if (!result.draft_reply || result.classification === 'spam') {
      respondXml(res, emptyTwiml())
      return
    }
    respondXml(res, toTwiml(result.draft_reply))
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to process inbound contact')
  }
}

function respondXml(res, xml) {
  res.status(200)
  res.setHeader('Content-Type', 'text/xml')
  res.send(xml)
}

function escapeXml(str = '') {
  return String(str).replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ))
}

function webhookUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const secret = encodeURIComponent(process.env.TELEPHONY_WEBHOOK_SECRET || '')
  return `${proto}://${host}/api/webhook/incoming?secret=${secret}`
}

function smsTwiml(reply) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`
}

function voiceGatherTwiml(greeting, req) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" method="POST" speechTimeout="auto" action="${escapeXml(webhookUrl(req))}"><Say>${escapeXml(greeting)}</Say></Gather><Say>Sorry, I didn't catch that. Please call back and try again.</Say><Hangup/></Response>`
}

function voiceReplyTwiml(reply) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(reply)}</Say><Hangup/></Response>`
}

function voiceFallbackTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we're unable to take your call right now. Please try again later.</Say><Hangup/></Response>`
}

function emptyTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
}

function parseGenericPayload(body = {}) {
  return {
    channel: body.Body ? 'text' : 'call',
    callerNumber: body.From || body.caller_number || 'unknown',
    message: body.Body || body.transcript || '',
  }
}
