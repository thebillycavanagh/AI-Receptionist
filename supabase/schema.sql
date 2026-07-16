-- ============================================================================
-- AI Receptionist — schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh
-- project. Everything hangs off business_profiles so the same schema can
-- serve many white-labeled clients later, even though V1 ships one row.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- business_profiles — one row per client/tenant. Every other table points
-- back here so a future multi-tenant deployment just adds rows, not tables.
-- ----------------------------------------------------------------------------
create table if not exists business_profiles (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references auth.users(id) on delete set null,
  name               text not null,
  industry           text not null default 'general',
  greeting_script    text not null default 'Thanks for calling — how can I help you today?',
  tone               text not null default 'friendly-professional'
                        check (tone in ('friendly-professional','formal','warm-casual','concise-direct')),
  timezone           text not null default 'America/New_York',
  business_hours     jsonb not null default '{}'::jsonb, -- e.g. {"mon":["09:00","17:00"], ...}
  after_hours_action text not null default 'voicemail'
                        check (after_hours_action in ('voicemail','ai_handle','forward')),
  forward_number     text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- handling_rules — configurable call-routing / spam logic per business.
-- rule_type is intentionally open (text) so new rule kinds don't need a
-- migration; rule_value carries whatever payload that rule_type expects.
-- ----------------------------------------------------------------------------
create table if not exists handling_rules (
  id                 uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  rule_type          text not null
                        check (rule_type in (
                          'route_to_voicemail',
                          'flag_as_spam',
                          'block_number',
                          'allow_number',
                          'escalate_urgent',
                          'unknown_number_handling'
                        )),
  rule_value         jsonb not null default '{}'::jsonb,
  is_enabled         boolean not null default true,
  priority           integer not null default 100, -- lower runs first
  created_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- faq_entries — knowledge base the AI pulls from when answering.
-- ----------------------------------------------------------------------------
create table if not exists faq_entries (
  id                 uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  question           text not null,
  answer             text not null,
  category           text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- call_logs — every handled call or text, AI-classified.
-- ----------------------------------------------------------------------------
create table if not exists call_logs (
  id                 uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  channel            text not null default 'call' check (channel in ('call','text')),
  caller_number      text,
  caller_name        text,
  classification     text not null default 'unclassified'
                        check (classification in (
                          'legitimate_inquiry',
                          'existing_contact',
                          'spam',
                          'wrong_number',
                          'unclassified'
                        )),
  urgency            text not null default 'normal' check (urgency in ('low','normal','high')),
  reason             text,          -- short reason for the contact, as understood by the AI
  summary            text,          -- AI-written summary of the interaction
  draft_reply        text,          -- what the AI actually said/texted back to the caller
  transcript         jsonb,         -- raw turn-by-turn transcript, if available
  status             text not null default 'new' check (status in ('new','needs_follow_up','resolved')),
  ai_confidence      numeric(3,2),  -- 0.00–1.00
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_call_logs_business on call_logs(business_profile_id);
create index if not exists idx_call_logs_status on call_logs(business_profile_id, status);
create index if not exists idx_call_logs_created on call_logs(business_profile_id, created_at desc);
create index if not exists idx_faq_business on faq_entries(business_profile_id);
create index if not exists idx_rules_business on handling_rules(business_profile_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_business_profiles_updated on business_profiles;
create trigger trg_business_profiles_updated
  before update on business_profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_faq_entries_updated on faq_entries;
create trigger trg_faq_entries_updated
  before update on faq_entries
  for each row execute function set_updated_at();

drop trigger if exists trg_call_logs_updated on call_logs;
create trigger trg_call_logs_updated
  before update on call_logs
  for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security
-- V1 model: an admin (owner) can only see/manage business_profiles they own,
-- and everything scoped under it. The webhook that ingests live calls/texts
-- runs server-side with the service_role key, which bypasses RLS entirely —
-- so inbound traffic never needs its own policy here.
-- ============================================================================

alter table business_profiles enable row level security;
alter table handling_rules enable row level security;
alter table faq_entries enable row level security;
alter table call_logs enable row level security;

create policy "Owners manage their own business profile"
  on business_profiles for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage rules for their profile"
  on handling_rules for all
  using (
    business_profile_id in (
      select id from business_profiles where owner_id = auth.uid()
    )
  )
  with check (
    business_profile_id in (
      select id from business_profiles where owner_id = auth.uid()
    )
  );

create policy "Owners manage FAQs for their profile"
  on faq_entries for all
  using (
    business_profile_id in (
      select id from business_profiles where owner_id = auth.uid()
    )
  )
  with check (
    business_profile_id in (
      select id from business_profiles where owner_id = auth.uid()
    )
  );

create policy "Owners manage call logs for their profile"
  on call_logs for all
  using (
    business_profile_id in (
      select id from business_profiles where owner_id = auth.uid()
    )
  )
  with check (
    business_profile_id in (
      select id from business_profiles where owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Seed: one starter business profile owned by no one yet.
-- After you create your first admin user via Supabase Auth, run:
--   update business_profiles set owner_id = '<your-user-uuid>' where name = 'Sample Business';
-- then copy its id into VITE_BUSINESS_PROFILE_ID.
-- ============================================================================
insert into business_profiles (name, industry, greeting_script, tone)
values (
  'Sample Business',
  'general',
  'Thanks for calling Sample Business — how can I help you today?',
  'friendly-professional'
)
on conflict do nothing;
