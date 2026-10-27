// GET /api/robot: the daily follow-up robot, called by Vercel Cron (vercel.json, 7:00 UTC).
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; any other call is refused.
import { createHash, timingSafeEqual } from 'node:crypto';
import { runRobot } from './_lib/followup.js';

function fromCron(req) {
  const secret = process.env.CRON_SECRET;
  const header = String(req.headers?.authorization || '');
  if (!secret || !header.startsWith('Bearer ')) return false;
  const hash = (s) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(secret));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!fromCron(req)) return res.status(401).json({ error: 'Not allowed' });
  try {
    const summary = await runRobot();
    console.log('robot:', JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err) {
    console.error('robot:', err.message);
    return res.status(500).json({ error: 'The robot failed, see the logs' });
  }
}
