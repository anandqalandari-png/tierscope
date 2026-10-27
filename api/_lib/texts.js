// The fixed words of the emails. Email 1 is normally written by Gemini (see prompt-email1.js);
// EMAIL_1 below is the fallback, sent when Gemini is unavailable. Drafted by the agent at the team's request.
// In the subject and bodies, {company}, {url}, {score} and {revenue_gap} become the lead's answers.

export const EMAIL_1 = {
  subject: 'Your Tierscope pricing report for {company}',
  body: `Hi,

Thanks for checking the pricing of {company} with Tierscope.

Your pricing score is {score}/100, and we estimate a revenue gap of {revenue_gap} a year compared with your closest competitors.

If you want to turn that into a concrete plan, we offer a 60-minute pricing review with a pricing strategist. Just reply to this email and we will find a time.

The Tierscope team`,
};

// The subject is email 1's subject with "Re: " in front, so it lands in the same thread (AGENTS.md).
// No {company} on purpose: the follow-up never pastes what the visitor typed.
export const FOLLOW_UP = {
  body: `Hi,

A quick follow-up on your Tierscope pricing report.

If you'd like a pricing strategist to go through it with you, the 60-minute pricing review is still open. Just reply to this email and we'll find a time.

The Tierscope team`,
};

// true: email 1 goes out by itself when a visitor unlocks a report and ticks the consent box.
// false: only the "Send email 1" button in the CRM sends it.
export const SEND_EMAIL_1_AUTOMATICALLY = true;

// Added under every email: why the person gets it (AGENTS.md, KEEP). Any reply stops all emails.
export const WHY_LINE =
  'You get this email because you asked for your Tierscope pricing report and ticked the box to hear from us. ' +
  'Reply "stop" and we will not email you again.';

export const followUpReady = () => FOLLOW_UP.body.trim() !== '';

export function fill(template, lead) {
  const a = (lead && lead.answers) || {};
  return String(template || '').replace(/\{(company|url|score|revenue_gap)\}/g, (_, key) => (a[key] == null ? '' : String(a[key])));
}
