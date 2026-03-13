export function getBaseUrl(req) {
  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const forwardedHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`.replace(/\/$/, '');
  }

  const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://kursnavi.ch';
  return raw.replace(/\/$/, '');
}

export function getDashboardUrl(req) {
  return `${getBaseUrl(req)}/dashboard`;
}
