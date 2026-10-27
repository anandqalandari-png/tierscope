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

// Sentences used instead when an answer is missing, so the fallback never has a blank (approved 27 Oct 2026).
export const EMAIL_1_MISSING = {
  subject: 'Your Tierscope pricing report',
  thanks: 'Thanks for checking your pricing with Tierscope.',
  noGap: 'Your pricing score is {score}/100. Your full report shows how your plans compare with your closest competitors.',
  noScore: 'Your full report shows how your plans compare with your closest competitors.',
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

// Added under every email: why the person gets it (AGENTS.md, KEEP). On a "stop" reply, the team marks the lead
// lost in /admin: a lost lead never gets another email, even if its address is used again.
export const WHY_LINE =
  'You get this email because you asked for your Tierscope pricing report and ticked the box to hear from us. ' +
  'Reply "stop" and we will not email you again.';

export const followUpReady = () => FOLLOW_UP.body.trim() !== '';

// The answers as they may appear in an email. Visitors can send anything to /api/leads, so anything that
// doesn't look like a real answer is dropped: an email never carries a visitor's own text, links or instructions.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} &.'-]*$/u;
const DOMAIN_RE = /[a-z0-9-]+\.(com|io|co|app|net|org|biz|ai|dev|fr|de|uk|xyz|info|me)\b/i;

export function nameFromUrl(url) {
  const parts = String(url || '').toLowerCase().split('/')[0].split('.');
  if (parts.length < 2) return '';
  let core = parts[parts.length - 2];
  if (['co', 'com'].includes(core) && parts.length > 2) core = parts[parts.length - 3];
  core = core.replace(/[^a-z0-9-]/g, '');
  return core.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 40);
}

export function safeAnswers(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const url = /^[a-z0-9.-]+\.[a-z]{2,}(\/[\w./%-]*)?$/i.test(String(a.url || '')) && String(a.url).length <= 120 ? String(a.url) : '';
  const name = String(a.company || '').trim();
  const nameOk = name.length >= 2 && name.length <= 40 && name.split(/\s+/).length <= 4 && NAME_RE.test(name) && !DOMAIN_RE.test(name);
  const category = String(a.category || '').trim();
  const score = Number(a.score);
  const gap = String(a.revenue_gap || '').trim();
  return {
    url,
    company: nameOk ? name : nameFromUrl(url),
    category: category.length <= 40 && /^[\p{L} &/-]+$/u.test(category) ? category : '',
    score: a.score != null && a.score !== '' && Number.isInteger(score) && score >= 0 && score <= 100 ? score : null,
    revenue_gap: /^€\d{1,3}(,\d{3})*–€\d{1,3}(,\d{3})*$/.test(gap) ? gap : '',
  };
}

export function fill(template, lead) {
  const a = safeAnswers(lead && lead.answers);
  return String(template || '').replace(/\{(company|url|score|revenue_gap)\}/g, (_, key) => (a[key] == null ? '' : String(a[key])));
}

// The fallback email 1, with the "missing" sentences where an answer is missing.
export function fallbackEmail1(lead) {
  const a = safeAnswers(lead && lead.answers);
  const f = (t) => fill(t, lead);
  let body = EMAIL_1.body;
  if (!a.company) body = body.replace('Thanks for checking the pricing of {company} with Tierscope.', EMAIL_1_MISSING.thanks);
  const scoreLine = 'Your pricing score is {score}/100, and we estimate a revenue gap of {revenue_gap} a year compared with your closest competitors.';
  if (a.score == null) body = body.replace(scoreLine, EMAIL_1_MISSING.noScore);
  else if (!a.revenue_gap) body = body.replace(scoreLine, EMAIL_1_MISSING.noGap);
  return { subject: a.company ? f(EMAIL_1.subject) : EMAIL_1_MISSING.subject, body: f(body) };
}
