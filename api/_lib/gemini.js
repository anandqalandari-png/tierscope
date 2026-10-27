// Gemini writes email 1 from the lead's answers. Called over Google's REST API (no extra library).
// If Gemini fails, is slow, or returns something unusable, the fixed fallback email is used instead.
import { BRIEF, MODELS } from './prompt-email1.js';
import { fallbackEmail1, safeAnswers } from './texts.js';

export const geminiDeps = { fetch: (...a) => fetch(...a) }; // tests swap this

// The lead's answers as Gemini sees them: cleaned first (safeAnswers drops anything that isn't a real answer),
// then fenced in <lead_answers> tags so they read as data, not instructions.
export function facts(lead) {
  const a = safeAnswers(lead.answers);
  const given = (v) => (v == null || String(v).trim() === '' ? 'not given' : String(v).replace(/[<>]/g, ''));
  return [
    '<lead_answers>',
    `Company: ${given(a.company)}`,
    `Pricing page: ${given(a.url)}`,
    `Software category: ${given(a.category)}`,
    `Pricing score: ${a.score != null ? given(a.score) + '/100' : 'not given'}`,
    `Estimated revenue gap per year: ${given(a.revenue_gap)}`,
    '</lead_answers>',
  ].join('\n');
}

export function fallbackEmail(lead) {
  return { ...fallbackEmail1(lead), source: 'fallback' };
}

// A usable email: a short subject, a body of reasonable length, nothing left to fill in, and no link,
// web address or discount (if Gemini was talked into one, the safe fallback is sent instead).
export function usable(e) {
  if (!e || typeof e.subject !== 'string' || typeof e.body !== 'string') return false;
  const all = e.subject + '\n' + e.body;
  return e.subject.trim().length >= 5 && e.subject.length <= 120 && !/[\r\n]/.test(e.subject.trim())
    && e.body.trim().length >= 150 && e.body.length <= 2500
    && !/[{}<>]|\[(name|company)\]/i.test(all)
    && !/https?:|www\.|@|[a-z0-9-]+\.(com|io|co|app|net|org|biz|ai|dev|fr|de|uk|xyz|info|me)\b/i.test(all)
    && !/discount|% off|coupon|free (month|trial)/i.test(all);
}

export async function writeEmail1(lead) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error('gemini: GEMINI_API_KEY is not set, using the fallback email'); return fallbackEmail(lead); }
  for (const model of MODELS) {
    try {
      const r = await geminiDeps.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${BRIEF}\n\nThe lead's answers, typed into our web form:\n${facts(lead)}` }] }],
          generationConfig: {
            temperature: 0.6,
            responseMimeType: 'application/json',
            responseSchema: { type: 'OBJECT', properties: { subject: { type: 'STRING' }, body: { type: 'STRING' } }, required: ['subject', 'body'] },
          },
        }),
      });
      if (!r.ok) throw new Error(`${model} answered ${r.status}: ${(await r.text()).slice(0, 160).replace(/\s+/g, ' ')}`);
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const email = JSON.parse(text);
      if (!usable(email)) throw new Error(`${model} returned an email that failed the checks`);
      return { subject: email.subject.trim(), body: email.body.trim(), source: 'gemini', model };
    } catch (err) {
      console.error('gemini:', err.message);
    }
  }
  console.error('gemini: no model worked, using the fallback email');
  return fallbackEmail(lead);
}
