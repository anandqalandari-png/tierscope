// The follow-up: one email, FOLLOW_UP_DAYS days after email 1, in the same Gmail thread.
// The team's choice: replies are not checked. A lead the team moves to replied, meeting, won or lost
// in the CRM is left alone, because only leads still "contacted" get a follow-up.
import { supabase } from './supabase.js';
import { sendEmail, gmailReady } from './mailer.js';
import { saveEmail, sentToday, DAILY_LIMIT } from './emails.js';
import { FOLLOW_UP, followUpReady } from './texts.js';

// Only leads that arrived from this moment get a follow-up. Earlier leads never do (team decision, 27 Oct 2026).
export const FOLLOW_UP_START = '2026-10-27T00:00:00Z';

export function followUpDays() {
  const n = Number(process.env.FOLLOW_UP_DAYS ?? 1);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

// Why this lead can't get the follow-up now, or '' when it can. `now` skips the waiting time (test button).
export function followUpBlocked(lead, { now = false } = {}) {
  if (!followUpReady()) return 'The follow-up text is empty';
  if (!lead.consent) return 'This lead did not agree to emails';
  if (lead.follow_ups > 0 || lead.status === 'followed_up') return 'The follow-up was already sent';
  if (lead.status !== 'contacted' || !lead.last_email_at) return lead.status === 'new' ? 'Email 1 was not sent yet' : `This lead is marked "${lead.status}"`;
  if (!(new Date(lead.created_at) >= new Date(FOLLOW_UP_START))) return 'This lead arrived before follow-ups started';
  if (!gmailReady()) return 'Gmail is not connected';
  if (!now && Date.now() - new Date(lead.last_email_at).getTime() < followUpDays() * 86400000) return 'Too early for the follow-up';
  return '';
}

// Sends the follow-up to one lead. Returns { sent: true } or { sent: false, reason }.
export async function sendFollowUp(lead, { now = false } = {}) {
  const blocked = followUpBlocked(lead, { now });
  if (blocked) return { sent: false, reason: blocked };

  const [first] = await supabase(`emails?lead_id=eq.${lead.id}&direction=eq.out&order=sent_at.asc&limit=1&select=subject,message_id`);
  if (!first) return { sent: false, reason: 'Email 1 was not found in the emails table' };

  // Claim the lead first, so the robot and a click never send two follow-ups.
  const claimed = await supabase(`leads?id=eq.${lead.id}&status=eq.contacted&follow_ups=eq.0`, {
    method: 'PATCH',
    body: { status: 'followed_up', follow_ups: 1, last_email_at: new Date().toISOString() },
    prefer: 'return=representation',
  });
  if (!claimed.length) return { sent: false, reason: 'The follow-up was already sent' };

  const subject = /^re:/i.test(first.subject || '') ? first.subject : `Re: ${first.subject || 'Your Tierscope pricing report'}`;
  let mail;
  try {
    mail = await sendEmail({ to: lead.email, subject, text: FOLLOW_UP.body, inReplyTo: first.message_id || undefined });
  } catch (err) {
    // Not sent: put the lead back so the next run tries again.
    await supabase(`leads?id=eq.${lead.id}`, { method: 'PATCH', body: { status: 'contacted', follow_ups: 0, last_email_at: lead.last_email_at } }).catch(() => {});
    throw err;
  }
  await saveEmail({ lead_id: lead.id, direction: 'out', subject, body: FOLLOW_UP.body, message_id: mail.messageId, sent_at: mail.sentAt });
  await supabase(`leads?id=eq.${lead.id}`, { method: 'PATCH', body: { last_email_at: mail.sentAt } });
  return { sent: true };
}

// The daily robot: every lead that is due gets its one follow-up. Running it twice sends nothing more.
export async function runRobot() {
  const summary = { checked: 0, followUpsSent: 0, skipped: [], errors: [] };
  if (!followUpReady()) { summary.errors.push('The follow-up text is empty'); return summary; }
  if (!gmailReady()) { summary.errors.push('Gmail is not connected'); return summary; }

  const cutoff = new Date(Date.now() - followUpDays() * 86400000).toISOString();
  const due = await supabase(
    'leads?select=id,email,consent,status,created_at,last_email_at,follow_ups' +
    `&status=eq.contacted&consent=is.true&follow_ups=eq.0&created_at=gte.${encodeURIComponent(FOLLOW_UP_START)}` +
    `&last_email_at=lte.${encodeURIComponent(cutoff)}&order=last_email_at.asc&limit=200`,
  );
  summary.checked = due.length;

  let left = DAILY_LIMIT - (await sentToday());
  for (const lead of due) {
    if (left <= 0) { summary.errors.push(`The daily limit of ${DAILY_LIMIT} emails is reached`); break; }
    try {
      const r = await sendFollowUp(lead);
      if (r.sent) { summary.followUpsSent++; left--; } else summary.skipped.push(`${lead.email}: ${r.reason}`);
    } catch (err) {
      summary.errors.push(`${lead.email}: ${err.message.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
  return summary;
}
