// Email 1, the sending limits, and saving every email in the emails table (AGENTS.md, Emails).
import { supabase } from './supabase.js';
import { sendEmail, gmailReady } from './mailer.js';
import { writeEmail1 } from './gemini.js';

// Limits that keep the project Gmail safe from abuse (someone typing a stranger's address again and again).
export const DAILY_LIMIT = 100;        // all emails, per UTC day
export const HOURLY_LIMIT = 30;        // all emails, in the last hour: slows down a burst
export const PER_ADDRESS_LIMIT = 5;    // emails to one address in the last 24 hours (team decision)
export const PER_ADDRESS_GAP_MS = 60000; // at least 1 minute between two emails to one address

// Statuses the team sets by hand. They are kept when email 1 is sent again, and get no follow-up.
export const KEPT_STATUSES = ['replied', 'meeting', 'won'];

const since = (ms) => encodeURIComponent(new Date(Date.now() - ms).toISOString());
const count = async (filter) => (await supabase(`emails?select=id&direction=eq.out&${filter}`)).length;

export async function sentToday() {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  return count(`sent_at=gte.${encodeURIComponent(midnight.toISOString())}`);
}

// Why no email may go out right now (to anyone, or to this lead), or '' when it may.
export async function limitReached(leadId) {
  if ((await sentToday()) >= DAILY_LIMIT) return `The daily limit of ${DAILY_LIMIT} emails is reached`;
  if ((await count(`sent_at=gte.${since(3600000)}`)) >= HOURLY_LIMIT) return `The limit of ${HOURLY_LIMIT} emails an hour is reached, try again later`;
  if (leadId) {
    if ((await count(`lead_id=eq.${leadId}&sent_at=gte.${since(86400000)}`)) >= PER_ADDRESS_LIMIT) {
      return `This address already got ${PER_ADDRESS_LIMIT} emails in the last 24 hours`;
    }
    if ((await count(`lead_id=eq.${leadId}&sent_at=gte.${since(PER_ADDRESS_GAP_MS)}`)) > 0) return 'This address got an email less than a minute ago';
  }
  return '';
}

// The same email (same message id) is never saved twice.
export function saveEmail(row) {
  return supabase('emails?on_conflict=message_id', { method: 'POST', body: row, prefer: 'resolution=ignore-duplicates,return=minimal' });
}

// Why email 1 can't go to this lead, or '' when it can. Email 1 goes again every time a report is unlocked.
export function email1Blocked(lead) {
  if (!lead.consent) return 'This lead did not agree to emails';
  if (lead.status === 'lost') return 'This lead is marked lost (for example they asked us to stop): no more emails';
  if (!gmailReady()) return 'Gmail is not connected';
  return '';
}

// Sends email 1 to one lead, written by Gemini (or the fallback text).
// Returns { sent: true, source } or { sent: false, reason }.
export async function sendEmail1(lead) {
  const blocked = email1Blocked(lead) || (await limitReached(lead.id));
  if (blocked) return { sent: false, reason: blocked };

  // Claim the lead first: two clicks (or a click and a sign-up) in the same minute never send two emails.
  const before = { status: lead.status, last_email_at: lead.last_email_at ?? null, follow_ups: lead.follow_ups ?? 0 };
  const status = KEPT_STATUSES.includes(lead.status) ? lead.status : 'contacted';
  const gap = encodeURIComponent(new Date(Date.now() - PER_ADDRESS_GAP_MS).toISOString());
  const claimed = await supabase(`leads?id=eq.${lead.id}&status=neq.lost&or=(last_email_at.is.null,last_email_at.lt.${gap})`, {
    method: 'PATCH',
    // follow_ups back to 0: this new email 1 gets its own follow-up the next day.
    body: { status, last_email_at: new Date().toISOString(), follow_ups: 0 },
    prefer: 'return=representation',
  });
  if (!claimed.length) return { sent: false, reason: 'This address got an email less than a minute ago' };

  let mail, subject, text, source;
  try {
    ({ subject, body: text, source } = await writeEmail1(lead));
    mail = await sendEmail({ to: lead.email, subject, text });
  } catch (err) {
    // Not sent: put the lead back as it was.
    await supabase(`leads?id=eq.${lead.id}`, { method: 'PATCH', body: before }).catch(() => {});
    throw err;
  }
  await saveEmail({ lead_id: lead.id, direction: 'out', subject, body: text, message_id: mail.messageId, sent_at: mail.sentAt });
  await supabase(`leads?id=eq.${lead.id}`, { method: 'PATCH', body: { last_email_at: mail.sentAt } });
  return { sent: true, source };
}
