import { getSupabaseAdmin } from './supabaseAdmin.js'

/**
 * Runs the full inbound-contact pipeline for one call or text:
 *   1. Load the business profile, handling rules, and FAQs.
 *   2. Apply deterministic rules first (block/allow lists) — cheap and
 *      predictable, and lets an admin hard-override the AI.
 *   3. If no deterministic rule decided the outcome, ask the LLM to
 *      classify + summarize using the business's configured tone and FAQs.
 *   4. Write the result to call_logs and return it.
 *
 * @param {object} input
 * @param {string} input.businessProfileId
 * @param {'call'|'text'} input.channel
 * @param {string} input.callerNumber
 * @param {string} [input.callerName]
 * @param {string} input.message - transcript or text body to classify
 */
export async function classifyAndLog(input) {
  const { businessProfileId, channel, callerNumber, callerName, message } = input
  const supabase = getSupabaseAdmin()

  const [{ data: profile, error: profileError }, { data: rules }, { data: faqs }] =
    await Promise.all([
      supabase.from('business_profiles').select('*').eq('id', businessProfileId).single(),
      supabase
        .from('handling_rules')
        .select('*')
        .eq('business_profile_id', businessProfileId)
        .eq('is_enabled', true)
        .order('priority', { ascending: true }),
      supabase
        .from('faq_entries')
        .select('question, answer')
        .eq('business_profile_id', businessProfileId)
        .eq('is_active', true),
    ])

  if (profileError || !profile) {
    throw new Error(`Unknown business profile: ${businessProfileId}`)
  }

  // ---- Step 1: deterministic rules ----------------------------------
  const ruleOutcome = applyDeterministicRules({ rules: rules || [], callerNumber })
  if (ruleOutcome) {
    return await writeCallLog(supabase, {
      business_profile_id: businessProfileId,
      channel,
      caller_number: callerNumber,
      caller_name: callerName || null,
      classification: ruleOutcome.classification,
      urgency: 'low',
      reason: ruleOutcome.reason,
      summary: ruleOutcome.reason,
      draft_reply: null,
      status: 'resolved',
      ai_confidence: 1.0,
    })
  }

  // ---- Step 2: AI classification -------------------------------------
  const aiResult = await classifyWithLLM({ profile, faqs: faqs || [], message })

  return await writeCallLog(supabase, {
    business_profile_id: businessProfileId,
    channel,
    caller_number: callerNumber,
    caller_name: callerName || null,
    classification: aiResult.classification,
    urgency: aiResult.urgency,
    reason: aiResult.reason,
    summary: aiResult.summary,
    draft_reply: aiResult.draftReply,
    status: aiResult.classification === 'spam' ? 'resolved' : 'new',
    ai_confidence: aiResult.confidence,
    transcript: message ? { turns: [{ role: 'caller', text: message }] } : null,
  })
}

function applyDeterministicRules({ rules, callerNumber }) {
  for (const rule of rules) {
    if (rule.rule_type === 'block_number') {
      const numbers = rule.rule_value?.numbers || []
      if (callerNumber && numbers.includes(callerNumber)) {
        return { classification: 'spam', reason: 'Caller number matches a configured block list.' }
      }
    }
    if (rule.rule_type === 'flag_as_spam') {
      const patterns = rule.rule_value?.patterns || []
      if (callerNumber && patterns.some((p) => callerNumber.includes(p))) {
        return { classification: 'spam', reason: 'Caller number matches a configured spam pattern.' }
      }
    }
  }
  return null
}

async function classifyWithLLM({ profile, faqs, message }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY server environment variable.')
  }

  const faqBlock = faqs.length
    ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '(no FAQ entries configured)'

  const systemPrompt = `You are the AI receptionist for "${profile.name}", a ${profile.industry} business.
Greeting script: "${profile.greeting_script}"
Tone to use in any drafted reply: ${profile.tone}.

Reference FAQ knowledge base:
${faqBlock}

Given the caller's message, classify the contact and draft the reply you — the receptionist —
would actually say/text back to them right now, in the tone above and using the FAQ knowledge
where it answers their question. Keep draft_reply short and speakable (1-3 sentences); it may be
read aloud on a phone call or sent as a text, so avoid markdown, links, or anything that only
makes sense in writing. If the message is spam or a wrong number, set draft_reply to null —
we don't engage those.

Respond with ONLY a JSON object (no markdown, no preamble) matching this shape:
{
  "classification": "legitimate_inquiry" | "existing_contact" | "spam" | "wrong_number",
  "urgency": "low" | "normal" | "high",
  "reason": "short phrase describing why they're contacting the business",
  "summary": "1-2 sentence summary of the interaction, written for a human reviewing a log",
  "draft_reply": "what to say/text back, in the business's tone, or null for spam/wrong numbers",
  "confidence": 0.0-1.0
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const text = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  try {
    const cleaned = text.replace(/^```json\s*|```$/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      classification: parsed.classification || 'legitimate_inquiry',
      urgency: parsed.urgency || 'normal',
      reason: parsed.reason || '',
      summary: parsed.summary || '',
      draftReply: parsed.draft_reply || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch {
    // If the model didn't return clean JSON, fail safe: log it as needing a
    // human look rather than silently dropping the contact.
    return {
      classification: 'legitimate_inquiry',
      urgency: 'normal',
      reason: 'Could not auto-classify — review manually.',
      summary: text.slice(0, 500),
      draftReply: "Thanks for reaching out — we'll get back to you shortly.",
      confidence: 0.2,
    }
  }
}

async function writeCallLog(supabase, row) {
  const { data, error } = await supabase.from('call_logs').insert(row).select().single()
  if (error) throw error
  return data
}
