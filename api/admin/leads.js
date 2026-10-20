// GET /api/admin/leads: every lead, newest first, with its emails and its ranking.
//   ?sample=1 returns fake leads for demos instead, without touching the database.
// PATCH /api/admin/leads: change one lead's status or notes. Body: { id, status?, notes? }
// Both need the admin password, checked here on the server.
import { isAdmin } from '../_lib/auth.js';
import { supabase, readJson } from '../_lib/supabase.js';
import { rankLead } from '../_lib/rank.js';
import { sampleLeads } from '../_lib/sample.js';

const STATUSES = ['new', 'contacted', 'followed_up', 'replied', 'meeting', 'won', 'lost'];
const COLUMNS = 'id,created_at,name,email,consent,answers,status,notes,last_email_at,follow_ups';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD) {
    console.error('admin: ADMIN_PASSWORD is not set');
    return res.status(500).json({ error: 'The admin password is not set up yet' });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: 'Wrong password' });

  try {
    if (req.method === 'GET') {
      const now = Date.now();
      const sample = new URL(req.url, 'http://localhost').searchParams.get('sample') === '1';
      const rows = sample
        ? sampleLeads(now)
        : await supabase(`leads?select=${COLUMNS},emails(id,direction,subject,body,sent_at)&order=created_at.desc&limit=1000`);
      const leads = rows.map((lead) => ({
        ...lead,
        emails: (lead.emails || []).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at))),
        rank: rankLead(lead, now),
      }));
      return res.status(200).json({ leads, sample });
    }

    if (req.method === 'PATCH') {
      const body = readJson(req);
      if (!body || !UUID_RE.test(String(body.id || ''))) return res.status(400).json({ error: 'Unknown lead' });

      const changes = {};
      if ('status' in body) {
        if (!STATUSES.includes(body.status)) return res.status(400).json({ error: 'Unknown status' });
        changes.status = body.status;
      }
      if ('notes' in body) changes.notes = body.notes ? String(body.notes).slice(0, 5000) : null;
      if (!Object.keys(changes).length) return res.status(400).json({ error: 'Nothing to change' });

      const rows = await supabase(`leads?id=eq.${body.id}&select=${COLUMNS}`, {
        method: 'PATCH',
        body: changes,
        prefer: 'return=representation',
      });
      if (!rows.length) return res.status(404).json({ error: 'Unknown lead' });
      return res.status(200).json({ lead: { ...rows[0], rank: rankLead(rows[0]) } });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Use GET or PATCH' });
  } catch (err) {
    console.error('admin:', err.message);
    return res.status(502).json({ error: 'Could not reach the database' });
  }
}
