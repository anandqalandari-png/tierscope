import { createHash, timingSafeEqual } from 'node:crypto';

// True when the request carries "Authorization: Bearer <ADMIN_PASSWORD>".
export function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const header = String(req.headers?.authorization || '');
  if (!expected || !header.startsWith('Bearer ')) return false;
  const hash = (s) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(expected));
}
