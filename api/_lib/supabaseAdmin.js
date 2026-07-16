import { createClient } from '@supabase/supabase-js'

// This file only ever runs on the server (Vercel serverless functions).
// It uses the service_role key, which bypasses Row Level Security, so it
// must NEVER be imported from anything in /src that ships to the browser.
export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY server environment variables.',
    )
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
