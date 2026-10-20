// Ranks a lead from 0 to 100 with the "good lead" rules in AGENTS.md, and says why.
// A good lead: a B2B SaaS with a low pricing score, a big revenue gap, a work email and consent.

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'live.com', 'live.fr',
  'msn.com', 'yahoo.com', 'yahoo.fr', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com',
  'gmx.fr', 'orange.fr', 'free.fr', 'laposte.net', 'wanadoo.fr', 'sfr.fr', 'mail.com', 'yandex.com',
]);
// The try-it links on the landing page, and its sample report.
const DEMO_SITES = ['linear.app', 'hubspot.com', 'northwind-crm.com'];

export const OPEN_STATUSES = ['new', 'contacted', 'followed_up', 'replied', 'meeting'];

// "€57,000–€85,000" -> 57000
export function gapLow(text) {
  const m = String(text || '').match(/\d[\d,.\s]*/);
  return m ? Number(m[0].replace(/\D/g, '')) || 0 : 0;
}

export function rankLead(lead, now = Date.now()) {
  const a = lead.answers || {};
  const site = String(a.url || '').toLowerCase().split('/')[0];
  const domain = String(lead.email || '').toLowerCase().split('@')[1] || '';
  const gap = gapLow(a.revenue_gap);

  if (DEMO_SITES.some((d) => site === d || site.endsWith('.' + d))) {
    return { priority: 0, tier: 'ignore', gap, reasons: [{ label: `Tried a demo link (${site})`, points: 0 }] };
  }

  const reasons = [];
  const score = Number(a.score);
  if (a.score != null && Number.isFinite(score)) {
    reasons.push({
      label: `Pricing score ${score}/100` + (score < 60 ? ': lots of room to help' : ''),
      points: Math.round(30 * Math.min(1, Math.max(0, (80 - score) / 50))),
    });
  }
  if (gap) {
    reasons.push({
      label: `Revenue gap from €${gap.toLocaleString('en-US')} a year`,
      points: gap >= 100000 ? 25 : gap >= 50000 ? 18 : gap >= 20000 ? 12 : gap >= 5000 ? 6 : 0,
    });
  }
  const work = domain !== '' && !FREE_MAIL.has(domain);
  reasons.push({ label: work ? `Work email (${domain})` : 'Personal email', points: work ? 20 : 0 });
  reasons.push({ label: lead.consent ? 'Agreed to emails' : 'Did not agree to emails', points: lead.consent ? 15 : 0 });

  const days = (now - new Date(lead.created_at).getTime()) / 86400000;
  reasons.push({
    label: days <= 7 ? 'Arrived in the last 7 days' : days <= 30 ? 'Arrived in the last 30 days' : 'Arrived over 30 days ago',
    points: days <= 7 ? 10 : days <= 30 ? 5 : 0,
  });

  const priority = Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0));
  return { priority, tier: priority >= 70 ? 'hot' : priority >= 45 ? 'warm' : 'cold', gap, reasons };
}
