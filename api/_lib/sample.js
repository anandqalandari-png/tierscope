// Fake leads for demos ("Sample data" switch on /admin). Generated on the fly, never saved.
// Email subjects and bodies are labels only: the team writes the real email texts.

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRE = ['Pipe', 'Deal', 'Bright', 'Ledger', 'Flow', 'Stack', 'Pulse', 'Orbit', 'Clear', 'Nimble', 'Vector', 'Signal',
  'Harbor', 'Quill', 'Atlas', 'Kite', 'Loop', 'Cobalt', 'Ember', 'Tidal', 'Summit', 'Beacon', 'Folio', 'Ridge', 'Lumen', 'Cedar'];
const SUF = ['well', 'mint', 'wise', 'lane', 'kit', 'loom', 'base', 'ly', 'desk', 'hq', 'grid', 'forge', 'path', 'nest', 'works', 'hub'];
const CATS = ['CRM', 'Project management', 'Product analytics', 'Customer support', 'HR software', 'Design and collaboration',
  'Email marketing', 'Security'];
const FIRST = ['anna', 'tom', 'lea', 'marc', 'sofia', 'yuki', 'omar', 'ines', 'paul', 'nina', 'jonas', 'clara', 'hugo', 'maya', 'sam', 'eva'];
const FREE = ['gmail.com', 'outlook.com', 'yahoo.fr'];
const NOTES = ['Sample note: asked for prices in USD', 'Sample note: call booked', 'Sample note: wants the team plan', ''];

export function sampleLeads(now = Date.now()) {
  const r = rng(20261020);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const hour = 3600000;
  const day = 24 * hour;
  const seen = new Set();
  const leads = [];

  for (let i = 0; leads.length < 64 && i < 500; i++) {
    const company = pick(PRE) + pick(SUF);
    const slug = company.toLowerCase();
    if (seen.has(slug)) continue;
    seen.add(slug);

    const daysAgo = Math.pow(r(), 1.4) * 45;
    const created = now - daysAgo * day;
    const personal = r() < 0.18;
    const demo = r() < 0.06;
    const consent = r() < 0.78;
    const tld = pick(['.io', '.com', '.app', '.co']);
    const email = personal ? `${pick(FIRST)}.${slug}@${pick(FREE)}` : `${pick(FIRST)}@${slug}${tld}`;
    const score = 31 + Math.floor(r() * 54);
    const gap = Math.round(4 + r() * r() * 160) * 1000;

    let status = 'new';
    if (daysAgo > 1) {
      const x = r();
      status = !consent ? (x < 0.85 ? 'new' : 'lost')
        : x < 0.3 ? 'new' : x < 0.52 ? 'contacted' : x < 0.66 ? 'followed_up' : x < 0.78 ? 'replied'
        : x < 0.88 ? 'meeting' : x < 0.94 ? 'won' : 'lost';
    }
    if (status === 'followed_up' && daysAgo < 4) status = 'contacted';

    const emails = [];
    let last = null;
    let followUps = 0;
    const out = (subject, at) => { emails.push({ id: `s${i}-${emails.length}`, direction: 'out', subject, body: 'Sample email, not sent.', sent_at: new Date(at).toISOString() }); last = at; };
    if (status !== 'new' && consent) {
      out('[Sample] Email 1', created + hour);
      if (status !== 'contacted' && daysAgo > 4 && r() < 0.6) { out('[Sample] Re: Email 1', created + 3 * day + hour); followUps = 1; }
      if (['replied', 'meeting', 'won'].includes(status)) {
        const at = Math.min(now - hour, last + (0.5 + r() * 2) * day);
        emails.push({ id: `s${i}-in`, direction: 'in', subject: 'Re: [Sample] Email 1', body: 'Sample reply.', sent_at: new Date(at).toISOString() });
      }
    }
    if (status === 'followed_up' && !followUps) status = 'contacted';

    leads.push({
      id: `sample-${i}`,
      created_at: new Date(created).toISOString(),
      name: null,
      email,
      consent,
      answers: {
        url: demo ? pick(['linear.app/pricing', 'hubspot.com/pricing']) : `${slug}${tld}/pricing`,
        company,
        category: pick(CATS),
        score,
        revenue_gap: `€${gap.toLocaleString('en-US')}–€${Math.round(gap * 1.5).toLocaleString('en-US')}`,
        report_id: String(1000 + Math.floor(r() * 9000)),
      },
      status,
      notes: ['meeting', 'won', 'replied'].includes(status) ? pick(NOTES) || null : null,
      last_email_at: last ? new Date(last).toISOString() : null,
      follow_ups: followUps,
      emails: emails.reverse(),
    });
  }
  return leads.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
