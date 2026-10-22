// Email 1, the daily limit, and saving every email in the emails table (AGENTS.md, Emails).
import { supabase } from './supabase.js';
import { sendEmail, gmailReady } from './mailer.js';
import { writeEmail1 } from './gemini.js';

export const DAILY_LIMIT = 100;

export async function sentToday() {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const rows = await supabase(`emails?select=id&direction=eq.out&sent_at=gte.${encodeURIComponent(midnight.toISOString())}`);
  return rows.length;
}

// The same email (same message id) is never saved twice.
export function saveEmail(row) {
  return supabase('emails?on_conflict=message_id', { method: 'POST', body: row, prefer: 'resolution=ignore-duplicates,return=minimal' });
}

// Why email 1 can't go to this lead right now, or '' when it can.
export function email1Blocked(lead) {
  if (!lead.consent) return 'This lead did not agree to emails';
  if (lead.status !== 'new' || lead.last_email_at) return 'Email 1 was already sent';
  if (!gmailReady()) return 'Gmail is not connected';
  return '';
}

// Sends email 1 to one lead, written by Gemini (or the fallback text).
// Returns { sent: true, source } or { sent: false, reason }.
export async function sendEmail1(lead) {
  const blocked = email1Blocked(lead);
  if (blocked) return { sent: false, reason: blocked };
  if ((await sentToday()) >= DAILY_LIMIT) return { sent: false, reason: `The daily limit of ${DAILY_LIMIT} emails is reached` };

  // Claim the lead first, so two clicks (or a click and a sign-up) never send email 1 twice.
  const claimed = await supabase(`leads?id=eq.${lead.id}&status=eq.new&last_email_at=is.null`, {
    method: 'PATCH',
    body: { status: 'contacted', last_email_at: new Date().toISOString() },
    prefer: 'return=representation',
  });
  if (!claimed.length) return { sent: false, reason: 'Email 1 was already sent' };

  let mail, subject, text, source;
  try {
    ({ subject, body: text, source } = await writeEmail1(lead));
    mail = await sendEmail({ to: lead.email, subject, text });
  } catch (err) {
    // Not sent: put the lead back so email 1 can be tried again.
    await supabase(`leads?id=eq.${lead.id}`, { method: 'PATCH', body: { status: 'new', last_email_at: null } }).catch(() => {});
    throw err;
  }
  await saveEmail({ lead_id: lead.id, direction: 'out', subject, body: text, message_id: mail.messageId, sent_at: mail.sentAt });
  await supabase(`leads?id=eq.${lead.id}`, { method: 'PATCH', body: { last_email_at: mail.sentAt } });
  return { sent: true, source };
}
