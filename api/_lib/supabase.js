// Calls Supabase's REST API with the service role key. Server code only.
// Files in api/_lib are shared helpers: Vercel does not turn them into routes.

export async function supabase(path, { method = 'GET', body, prefer } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');

  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Newer "sb_secret_" keys go in the apikey header only.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;

  const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase answered ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export function readJson(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  return body && typeof body === 'object' ? body : null;
}
