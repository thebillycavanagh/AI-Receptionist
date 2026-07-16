# Front Desk — white-label AI receptionist

A configurable AI receptionist admin console. One codebase, reconfigured per
client entirely through data (business name, tone, greeting, handling rules,
FAQs) — never through code changes.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend/DB/Auth:** Supabase (Postgres, Row Level Security, Auth)
- **AI:** Anthropic API (Claude), called server-side only
- **Deploy:** Vercel (static frontend + `/api` serverless functions)

## How it fits together

```
Caller / texter
      │
      ▼
telephony or SMS provider (Twilio, etc.)
      │  webhook
      ▼
/api/webhook/incoming.js  ──┐
                             ├──►  api/_lib/classify.js
/api/classify.js  (Simulator)┘        │  1. load business_profile + rules + FAQs
                                       │  2. apply deterministic rules (block/spam lists)
                                       │  3. else classify with Claude, using tone + FAQs
                                       ▼
                                 call_logs table
                                       │
                                       ▼
                         Inbox page (React admin console)
```

Everything is scoped by `business_profile_id`, so the schema already supports
many tenants — V1 just runs with one row.

## Project structure

```
├── api/                      Vercel serverless functions (server-only, has the AI + DB keys)
│   ├── _lib/
│   │   ├── classify.js       Core pipeline: rules → AI classification → call_logs write
│   │   └── supabaseAdmin.js  Service-role Supabase client (server only)
│   ├── classify.js           POST endpoint used by the in-app Simulator
│   └── webhook/incoming.js   POST endpoint your telephony/SMS provider calls
├── src/
│   ├── components/           Layout, route guard, badges
│   ├── context/AuthContext.jsx
│   ├── lib/
│   │   ├── api.js            All Supabase reads/writes, scoped by business_profile_id
│   │   └── supabaseClient.js Browser Supabase client (anon key only)
│   ├── pages/
│   │   ├── Inbox.jsx         Log view — filter, search, mark follow-up/resolved
│   │   ├── Simulator.jsx     Send a test call/text through the pipeline
│   │   ├── Login.jsx
│   │   └── Settings/         Business profile, handling rules, FAQ editor
│   └── App.jsx / main.jsx
├── supabase/schema.sql       Full schema + RLS policies + seed row
└── vercel.json
```

## Local setup

1. **Create a Supabase project.** In the SQL editor, run `supabase/schema.sql`.
2. **Create your admin user** in Supabase → Authentication → Users (email +
   password). No public sign-up exists by design.
3. **Claim the seed business profile:**
   ```sql
   update business_profiles set owner_id = '<your-user-uuid>' where name = 'Sample Business';
   ```
   Copy that profile's `id`.
4. **Copy env file:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Project Settings → API
   - `VITE_BUSINESS_PROFILE_ID` — the profile id from step 3
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API (keep secret, server-only)
   - `ANTHROPIC_API_KEY` — from console.anthropic.com (server-only)
   - `TELEPHONY_WEBHOOK_SECRET` — any random string you'll also configure in your telephony provider
5. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   The Vite dev server won't execute `/api` functions on its own — use
   `vercel dev` instead if you want to test the Simulator or webhook locally
   with real serverless functions (`npm i -g vercel && vercel dev`).

## Deploying to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add all variables from `.env.example` as Vercel Environment Variables
   (Project Settings → Environment Variables). `SUPABASE_SERVICE_ROLE_KEY` and
   `ANTHROPIC_API_KEY` should **not** have the `VITE_` prefix, and are never
   sent to the browser.
3. Deploy.

## Connecting a real Twilio number

Point **both** of these at the same URL — the handler tells them apart by payload shape:

- Twilio Console → your number → **Voice Configuration → A call comes in**
- Twilio Console → your number → **Messaging Configuration → A message comes in**

```
https://<your-domain>/api/webhook/incoming?secret=<TELEPHONY_WEBHOOK_SECRET>
```

Twilio's webhook config has no way to set a custom header, so the shared
secret travels as a query param instead (HTTPS keeps it off the wire). Method
must be **HTTP POST**.

What happens on each channel:

- **SMS** — Twilio posts `Body`/`From`. The pipeline classifies + drafts a
  reply in the business's tone, texts it back via TwiML `<Message>`, and logs
  it to the Inbox. Spam gets silently dropped (no reply sent).
- **Voice** — the initial webhook (no `SpeechResult` yet) speaks the
  configured `greeting_script` and opens a `<Gather input="speech">`. Once
  Twilio transcribes what the caller says, it posts back to the same URL with
  `SpeechResult`, which runs through the same classify pipeline and speaks
  the AI's drafted reply before hanging up. This is a single-turn exchange
  (greet → listen once → reply → hang up) — multi-turn conversations would
  need a bigger IVR state machine on top of this.

Test the classification + reply logic without a phone number at all via the
in-app **Simulator** page.

## Adding a new white-label client

No code changes needed:

1. Insert a new row into `business_profiles` (or duplicate an existing one)
   with that client's name, industry, greeting, and tone.
2. Add their `handling_rules` and `faq_entries`, scoped to that profile id.
3. Point a new Vercel deployment (or a separate `VITE_BUSINESS_PROFILE_ID` /
   webhook route, if you evolve this into a true multi-tenant single
   deployment later) at that profile id.

## Notes on the AI pipeline

- Deterministic rules (`block_number`, `flag_as_spam`) always run **before**
  the AI, so an admin can hard-override behavior without depending on model
  judgment.
- The AI classification step only ever runs server-side (`api/_lib/classify.js`),
  using `ANTHROPIC_API_KEY` — this key is never exposed to the browser bundle.
- `api/classify.js` (used by the in-app Simulator) requires a valid Supabase
  session; `api/webhook/incoming.js` (used by real telephony traffic) requires
  the shared `TELEPHONY_WEBHOOK_SECRET` header instead, since a real caller
  has no Supabase session.
