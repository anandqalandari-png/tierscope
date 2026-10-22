// Gemini writes email 1 from the lead's answers. Called over Google's REST API (no extra library).
// If Gemini fails, is slow, or returns something unusable, the fixed fallback email is used instead.
import { BRIEF, MODELS } from './prompt-email1.js';
import { EMAIL_1, fill } from './texts.js';

export const geminiDeps = { fetch: (...a) => fetch(...a) }; // tests swap this

function facts(lead) {
  const a = lead.answers || {};
  return [
    `Company: ${a.company || 'unknown'}`,
    `Pricing page: ${a.url || 'unknown'}`,
    `Software category: ${a.category || 'unknown'}`,
    `Pricing score: ${a.score != null ? a.score + '/100' : 'unknown'}`,
    `Estimated revenue gap per year: ${a.revenue_gap || 'unknown'}`,
  ].join('\n');
}

export function fallbackEmail(lead) {
  return { subject: fill(EMAIL_1.subject, lead), body: fill(EMAIL_1.body, lead), source: 'fallback' };
}

// A usable email: a short subject, a body of reasonable length, nothing left to fill in.
function usable(e) {
  return e && typeof e.subject === 'string' && typeof e.body === 'string'
    && e.subject.trim().length >= 5 && e.subject.length <= 120
    && e.body.trim().length >= 150 && e.body.length <= 2500
    && !/[{}]|\[(name|company)\]/i.test(e.subject + e.body);
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
          contents: [{ role: 'user', parts: [{ text: `${BRIEF}\n\nThe lead's answers:\n${facts(lead)}` }] }],
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
