// POST /api/leads: saves a lead from the landing page in Supabase.
// The service role key stays on the server; the browser only ever calls this route.
import { supabase, readJson } from './_lib/supabase.js';
import { sendEmail1 } from './_lib/emails.js';
import { SEND_EMAIL_1_AUTOMATICALLY } from './_lib/texts.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEXT_FIELDS = ['url', 'company', 'category', 'revenue_gap', 'report_id'];

function cleanAnswers(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of TEXT_FIELDS) {
    if (a[key] != null) out[key] = String(a[key]).slice(0, 300);
  }
  const score = Number(a.score);
  if (Number.isFinite(score)) out.score = Math.round(score);
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }

  const body = readJson(req);
  if (!body) return res.status(400).json({ error: 'Send JSON' });

  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  const lead = { email, consent: body.consent === true, answers: cleanAnswers(body.answers) };

  let saved;
  try {
    // Same email again: update consent and answers, keep status and history.
    const rows = await supabase('leads?on_conflict=email', {
      method: 'POST',
      body: lead,
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    saved = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.error('leads:', err.message);
    return res.status(502).json({ error: 'Could not save' });
  }

  // Email 1, written by Gemini from these answers, every time a report is unlocked with consent
  // (team decision). sendEmail1 checks consent, "lost" leads and the sending limits.
  // A failure here never costs the visitor their report: the lead is saved either way.
  if (SEND_EMAIL_1_AUTOMATICALLY && saved && saved.consent) {
    try {
      const r = await sendEmail1(saved);
      console.log('leads: email 1', r.sent ? `sent (${r.source})` : `not sent: ${r.reason}`);
    } catch (err) {
      console.error('leads: email 1 failed:', err.message);
    }
  }

  return res.status(200).json({ ok: true });
}
