import { safeCompareSecret } from './lead-message-crypto.js';

/**
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 * Every state-changing scheduled endpoint must fail closed when the secret is
 * missing or does not match. Keeping this in one helper prevents the daily
 * and monthly jobs from drifting apart.
 */
export function requireCronSecret(req, res, label = 'cron') {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    console.error(`${label}: CRON_SECRET is not configured — refusing to run`);
    res.status(503).json({ error: 'CRON_SECRET is not configured' });
    return false;
  }

  const authHeader = req?.headers?.authorization || '';
  const presented = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!safeCompareSecret(presented, cronSecret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}
