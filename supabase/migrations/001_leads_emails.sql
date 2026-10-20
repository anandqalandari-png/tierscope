-- Tierscope: leads from the landing page and every email sent to or received from them.
-- Only the server touches these tables (service role key), so RLS is on with no policies.

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text not null unique check (email = lower(email)),
  consent boolean not null,
  answers jsonb,                -- url, company, category, score, revenue_gap, report_id
  status text not null default 'new'
    check (status in ('new', 'contacted', 'followed_up', 'replied', 'meeting', 'won', 'lost')),
  notes text,
  last_email_at timestamptz,
  follow_ups int not null default 0
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  direction text not null check (direction in ('out', 'in')),
  subject text,
  body text,
  message_id text unique,       -- the same email is never saved twice
  sent_at timestamptz not null default now()
);

create index emails_lead_id_idx on emails (lead_id);

alter table leads enable row level security;
alter table emails enable row level security;
