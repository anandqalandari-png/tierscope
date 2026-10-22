// The prompt file: what Gemini is asked to write for email 1. The team edits the BRIEF in plain words.
// The lead's answers are added below it automatically.

// Tried in order: when one is busy, the next one gets the same request.
export const MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];

export const BRIEF = `
You write the first email Tierscope sends to someone who just checked their SaaS pricing page with our free tool.

What it says:
- Thank them for running the pricing check for their company.
- Give their pricing score out of 100, and what it means in one sentence (under 60: real money left on the table; 60 and over: solid, with room to fine-tune).
- Mention their estimated revenue gap per year, as a range.
- Offer one next step: a 60-minute pricing review with a pricing strategist. Ask them to simply reply to this email to book it.

Tone: friendly, direct and confident, like a peer who knows pricing. No hype, no exclamation marks, no buzzwords.
Length: 80 to 120 words for the body. Short paragraphs, separated by a blank line. Start with "Hi,".
Sign off as "The Tierscope team".

Rules:
- Use only the facts given below. Never invent numbers, competitors, names or links.
- Plain text only: no markdown, no bullet symbols, no links.
- The subject is under 60 characters and mentions their company.
`.trim();
