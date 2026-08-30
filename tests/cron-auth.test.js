import { afterEach, describe, expect, it } from 'vitest';
import { requireCronSecret } from '../api/_lib/cron-auth.js';

const originalSecret = process.env.CRON_SECRET;

function makeResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe('requireCronSecret', () => {
  it('verweigert einen nicht konfigurierten Cron-Secret-Wert', () => {
    delete process.env.CRON_SECRET;
    const res = makeResponse();

    expect(requireCronSecret({ headers: {} }, res)).toBe(false);
    expect(res.statusCode).toBe(503);
  });

  it('verweigert fehlende oder falsche Berechtigungen', () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    const res = makeResponse();

    expect(requireCronSecret({ headers: { authorization: 'Bearer wrong-secret' } }, res)).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('akzeptiert exakt den von Vercel übermittelten Bearer-Token', () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    const res = makeResponse();

    expect(requireCronSecret({ headers: { authorization: 'Bearer test-cron-secret' } }, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });
});
