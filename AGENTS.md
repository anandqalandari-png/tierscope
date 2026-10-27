# AGENTS.md · Tierscope

## The project · YOURS

- **What our lead magnet does**: paste your SaaS pricing page and get a free pricing score in under a minute, then
  unlock a full report that compares your plans with your 20 closest competitors and recommends three changes.
- **Who it is for**: SaaS teams without a pricing department: founders (should we raise prices before our next
  round?), product managers (which plan should this feature go in?) and sales teams (why are you more expensive?).
- **What we want from a lead**: a booked pricing review, a paid 60-minute session with a pricing strategist.
- **What our form collects**: the pricing page URL, a work email and a consent checkbox. Email and consent have their
  own columns; `answers` holds `url`, `company`, `category`, `score`, `revenue_gap` and `report_id`.
- **A good lead for us**: the founder of a B2B SaaS with three paid plans who scores under 60 · **A lead we ignore**:
  someone trying the demo links (linear.app, hubspot.com) with a personal email.

Today the report is simulated in the browser from the URL (`index.html`): companies and figures are fictional.

## How you work with us · KEEP

1. **Plan first.** For every request, propose a short plan (files, tables, variables) and wait for our OK.
2. **Small steps.** After each step, tell us exactly how to check that it works.
3. **Secrets.** Never print, log or commit a secret. When we give you one in the chat, set it yourself in `.env.local`
   and in Vercel (`vercel env add`, value piped so it is never displayed, for every environment), then redeploy.
   Generate `CRON_SECRET` yourself.
4. **Ship.** When a step works, commit with a clear message and push to `main`: Vercel deploys on every push.
5. **Tools.** Supabase MCP for tables and rows, Vercel MCP for deployments and logs, the terminal for git and `vercel`.
6. **Ask before** adding a service, a library we did not mention or a paid plan.
7. **When something breaks**, read the error and the Vercel logs first, explain the cause, then fix.

## Infrastructure · KEEP

| Piece | What we use | Notes |
|---|---|---|
| Front + back-end | Our app on Vercel | The back-end is the app's server routes. Static site? Vercel Functions in `/api` (Node.js). |
| Database | Supabase, created from Vercel › Storage | The integration sets the Supabase variables in Vercel. Locally: `vercel link`, then `vercel env pull .env.local`. |
| Send emails | Our project Gmail, SMTP with Nodemailer | `smtp.gmail.com`, port 465, `secure: true`, an app password (not the account password). |
| Read replies | Same Gmail, IMAP with ImapFlow | `imap.gmail.com`, port 993, TLS, same app password. |
| Daily robot | Vercel Cron in `vercel.json` | Free plan: once a day, within the hour. |

Tierscope is a static site: the page is `index.html` at the root, server routes go in `/api`. The private CRM page is
`admin.html` (served at `/admin`) with its route `api/admin/leads.js`; shared server helpers live in `api/_lib/`.
The CRM ranks leads from 0 to 100 with the rules in `api/_lib/rank.js` (from "A good lead for us" above), and its
"Sample data" switch shows fake leads from `api/_lib/sample.js` that are never saved.

**Back-end rules**: the browser never talks to Supabase or Gmail, every read and write goes through our server routes.
`/admin` is protected by `ADMIN_PASSWORD`, checked on the server. The robot is a server route called by Vercel Cron,
which refuses any call without `Authorization: Bearer <CRON_SECRET>`.

## Environment variables · KEEP (names only, never the values)

| Variable | Set by | Used for |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel › Storage › Supabase | Server routes only: the service role key never reaches the browser. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | We create them in Google, you set them | SMTP and IMAP. |
| `ADMIN_PASSWORD` | We choose it, you set it | Login of `/admin`. |
| `CRON_SECRET` | You generate it (long random text) | Vercel sends it to the robot route. |
| `FOLLOW_UP_DAYS` | You, 1 (team decision) | Days after email 1 before the follow-up; 0 to test. |
| `GEMINI_API_KEY` | We create it in Google AI Studio, you set it | Gemini writes email 1. |

`.env.local` stays in `.gitignore`. After changing a variable in Vercel, redeploy.

## Database · KEEP the shape, adapt the fields

Two tables, created by `supabase/migrations/001_leads_emails.sql`. Keep `email`, `consent`, `status`,
`last_email_at` and `follow_ups`, which the emails and the robot rely on.

Tierscope change: `email` is unique and saved in lowercase, so a visitor who checks two URLs updates their lead
instead of getting two emails.

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text not null unique,   -- saved in lowercase by the server
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

alter table leads enable row level security;   -- no policy: only the server, with the service role key
alter table emails enable row level security;
```

## Emails · KEEP the settings, YOURS the words

- **KEEP**: sent from `"Tierscope" <GMAIL_USER>`, plain text plus a short HTML version, one line saying why the
  person receives it, only to leads with `consent = true`, at most 100 emails a day, tested on our own addresses first.
  Every email sent or received is saved in `emails`, and email 1 moves the lead to `contacted` with `last_email_at`.
- **YOURS · Email 1**: written by Gemini from the lead's answers, following the brief in `api/_lib/prompt-email1.js`
  (`GEMINI_API_KEY`). Sent automatically after a report is unlocked with consent, or with « Send email 1 » in `/admin`.
  If Gemini fails, the fallback text in `api/_lib/texts.js` is sent (drafted by the agent at the team's request).
- **YOURS · The follow-up**: one email, 1 day after email 1, same subject with « Re: », text in `FOLLOW_UP` in
  `api/_lib/texts.js` (agent's draft, approved by the team on 27 Oct 2026). Only for leads that arrived from 27 Oct 2026.
- **« Send email »** in `/admin`, next to each lead's status: sends email 1 at once from Gmail (never the Mac mail
  app), for a lead the automatic send missed. Leads without consent show « No consent » instead.

We write the texts: ask us for them, do not invent them.

## The follow-up robot · KEEP

Team decision (27 Oct 2026): **one** follow-up, `FOLLOW_UP_DAYS` (1) days after email 1, **without checking replies**.
Code: `api/robot.js` (route) and `api/_lib/followup.js` (rules). At every run:

1. Take the leads that are due: `status = 'contacted'`, `consent = true`, `follow_ups = 0`, `created_at` on or after
   `FOLLOW_UP_START` (27 Oct 2026: earlier leads never get a follow-up), `last_email_at` older than `FOLLOW_UP_DAYS`.
2. Send **one** follow-up in the same thread (same subject with « Re: »), save it in `emails`, set
   `status = 'followed_up'`, `follow_ups = 1`, `last_email_at = now()`. The lead is claimed before sending, so it is
   never sent twice; if Gmail fails, the lead is put back for the next run.
3. Replies are not read. A lead the team moves to `replied`, `meeting`, `won` or `lost` in `/admin` is skipped: that is
   how a « stop » or a booking reply stops the follow-up.
4. Never a second follow-up: running the robot twice in a row sends nothing more. At most 100 emails a day in all.
5. Return a summary: leads checked, follow-ups sent, skipped (with the reason), errors.

Scheduled once a day in `vercel.json` (`"schedule": "0 7 * * *"` is 7:00 UTC, 9:00 in Paris), with « Run robot now »
in `/admin` and « Send follow-up now » on a lead for tests (it skips the waiting time, not the other rules).

## Out of scope today · KEEP

The LLM (Thursday), mass emailing, open tracking, any paid service.
