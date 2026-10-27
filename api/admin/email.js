// POST /api/admin/email, admin password needed. Body:
//   { action: 'test' }               sends a test email to the project Gmail itself
//   { action: 'send-email1', id }    sends email 1 to one lead (Gemini text, or the fallback)
//   { action: 'send-follow-up', id } sends the follow-up to one lead now, without waiting (for tests)
//   { action: 'run-robot' }          runs the daily follow-up robot now
// GET returns what is set up, for the CRM.
import { isAdmin } from '../_lib/auth.js';
import { supabase, readJson } from '../_lib/supabase.js';
import { sendEmail, gmailReady } from '../_lib/mailer.js';
import { sendEmail1, sentToday, DAILY_LIMIT, HOURLY_LIMIT, PER_ADDRESS_LIMIT } from '../_lib/emails.js';
import { SEND_EMAIL_1_AUTOMATICALLY, followUpReady } from '../_lib/texts.js';
import { sendFollowUp, runRobot, followUpDays, FOLLOW_UP_START } from '../_lib/followup.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'The admin password is not set up yet' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Wrong password' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        gmail: gmailReady() ? process.env.GMAIL_USER : null,
        gemini: Boolean(process.env.GEMINI_API_KEY),
        auto: SEND_EMAIL_1_AUTOMATICALLY,
        sentToday: gmailReady() ? await sentToday() : 0,
        dailyLimit: DAILY_LIMIT,
        followUp: { ready: followUpReady(), days: followUpDays(), start: FOLLOW_UP_START },
        limits: { perAddress: PER_ADDRESS_LIMIT, hourly: HOURLY_LIMIT },
      });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Use GET or POST' }); }

    const body = readJson(req) || {};
    if (body.action === 'test') {
      const to = process.env.GMAIL_USER;
      await sendEmail({ to, subject: 'Tierscope: Gmail is connected', text: 'This test email was sent by your Tierscope CRM. If you can read it, sending works.', why: false });
      return res.status(200).json({ ok: true, message: `Test email sent to ${to}` });
    }
    if (body.action === 'send-email1') {
      if (!UUID_RE.test(String(body.id || ''))) return res.status(400).json({ error: 'Unknown lead' });
      const [lead] = await supabase(`leads?id=eq.${body.id}&select=id,email,consent,answers,status,last_email_at,follow_ups`);
      if (!lead) return res.status(404).json({ error: 'Unknown lead' });
      const r = await sendEmail1(lead);
      if (!r.sent) return res.status(409).json({ error: r.reason });
      return res.status(200).json({ ok: true, message: r.source === 'gemini' ? 'Email 1 sent, written by Gemini' : 'Email 1 sent (Gemini was busy, so the fallback text was used)' });
    }
    if (body.action === 'send-follow-up') {
      if (!UUID_RE.test(String(body.id || ''))) return res.status(400).json({ error: 'Unknown lead' });
      const [lead] = await supabase(`leads?id=eq.${body.id}&select=id,email,consent,status,created_at,last_email_at,follow_ups`);
      if (!lead) return res.status(404).json({ error: 'Unknown lead' });
      const r = await sendFollowUp(lead, { now: true });
      if (!r.sent) return res.status(409).json({ error: r.reason });
      return res.status(200).json({ ok: true, message: 'Follow-up sent' });
    }
    if (body.action === 'run-robot') {
      const s = await runRobot();
      const msg = `Robot done: ${s.checked} due, ${s.followUpsSent} follow-up${s.followUpsSent === 1 ? '' : 's'} sent` + (s.errors.length ? `, ${s.errors.length} error(s): ${s.errors[0]}` : '');
      return res.status(200).json({ ok: true, message: msg, summary: s });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('admin email:', err.message);
    return res.status(502).json({ error: err.message.replace(/\s+/g, ' ').slice(0, 200) });
  }
}
