import crypto from 'node:crypto';

// Auth is opt-in: if ADMIN_TOKEN is empty, the app stays fully open (handy for
// local use). When set, all write operations require the token.
export function authEnabled() {
  return Boolean((process.env.ADMIN_TOKEN || '').trim());
}

function extractToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return (req.get('x-admin-token') || '').trim();
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Middleware: blocks the request unless a valid token is supplied (only when
// auth is enabled).
export function requireAuth(req, res, next) {
  if (!authEnabled()) return next();
  const expected = process.env.ADMIN_TOKEN.trim();
  const given = extractToken(req);
  if (given && safeEqual(given, expected)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
