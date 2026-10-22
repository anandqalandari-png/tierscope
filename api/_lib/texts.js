// The words of the emails. AGENTS.md: the team writes them, the agent never invents them.
// In the subject and bodies, {company}, {url}, {score} and {revenue_gap} become the lead's answers.
// Nothing is sent to a lead until the text it needs is filled in (the CRM's test email always works).

export const EMAIL_1 = {
  subject: '',
  body: ``,
};

// The subject is email 1's subject with "Re: " in front, so it lands in the same thread (AGENTS.md).
export const FOLLOW_UP = {
  body: ``,
};

// true: email 1 goes out by itself when a visitor unlocks a report and ticks the consent box.
// false: only the "Send email 1" button in the CRM sends it.
export const SEND_EMAIL_1_AUTOMATICALLY = true;

// Added under every email: why the person gets it (AGENTS.md, KEEP). Any reply stops all emails.
export const WHY_LINE =
  'You get this email because you asked for your Tierscope pricing report and ticked the box to hear from us. ' +
  'Reply "stop" and we will not email you again.';

export const email1Ready = () => EMAIL_1.subject.trim() !== '' && EMAIL_1.body.trim() !== '';
export const followUpReady = () => email1Ready() && FOLLOW_UP.body.trim() !== '';

export function fill(template, lead) {
  const a = (lead && lead.answers) || {};
  return String(template || '').replace(/\{(company|url|score|revenue_gap)\}/g, (_, key) => (a[key] == null ? '' : String(a[key])));
}
