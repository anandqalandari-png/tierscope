// POST /api/leads: saves a lead from the landing page in Supabase.
// The service role key stays on the server; the browser only ever calls this route.

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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Send JSON' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('leads: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return res.status(500).json({ error: 'Could not save' });
  }

  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    // Same email again: update consent and answers, keep status and history.
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  // Newer "sb_secret_" keys go in the apikey header only.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

  const lead = { email, consent: body.consent === true, answers: cleanAnswers(body.answers) };

  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/leads?on_conflict=email`, {
      method: 'POST',
      headers,
      body: JSON.stringify(lead),
    });
    if (!r.ok) {
      console.error('leads: Supabase answered', r.status, await r.text());
      return res.status(502).json({ error: 'Could not save' });
    }
  } catch (err) {
    console.error('leads: could not reach Supabase', err.message);
    return res.status(502).json({ error: 'Could not save' });
  }

  return res.status(200).json({ ok: true });
}
