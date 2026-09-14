import { createHmac, timingSafeEqual } from 'crypto';

export const LEAD_ACTIONS = Object.freeze({
  acknowledged: 'Erhalten',
  qualified: 'Passend',
  not_qualified: 'Nicht passend',
  contacted: 'Kontakt aufgenommen',
});

function signaturePayload(leadId, action, expiresAt) {
  return `${leadId}.${action}.${expiresAt}`;
}

export function createLeadActionToken({ leadId, action, expiresAt, secret }) {
  if (!secret || !leadId || !LEAD_ACTIONS[action] || !Number.isFinite(Number(expiresAt))) return null;
  return createHmac('sha256', secret)
    .update(signaturePayload(leadId, action, Number(expiresAt)))
    .digest('base64url');
}

export function verifyLeadActionToken({ leadId, action, expiresAt, token, secret, now = Date.now() }) {
  const expiry = Number(expiresAt);
  if (!token || !secret || !Number.isFinite(expiry) || expiry < now || !LEAD_ACTIONS[action]) return false;
  const expected = createLeadActionToken({ leadId, action, expiresAt: expiry, secret });
  const expectedBuffer = Buffer.from(expected || '');
  const actualBuffer = Buffer.from(String(token));
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function buildLeadActionUrl({ baseUrl, leadId, action, secret, expiresAt = Date.now() + 7 * 86400000 }) {
  const token = createLeadActionToken({ leadId, action, expiresAt, secret });
  if (!token) return null;
  const params = new URLSearchParams({ lead: leadId, action, expires: String(expiresAt), token });
  return `${String(baseUrl).replace(/\/$/, '')}/api/lead-action?${params.toString()}`;
}
