import Stripe from 'stripe';
import { getRequiredSanitizedEnv } from './env.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_NETWORK_RETRIES = 1;

let stripeClient = null;

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsed = Number.parseInt(`${rawValue || ''}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseNonNegativeInteger(rawValue, fallbackValue) {
  const parsed = Number.parseInt(`${rawValue || ''}`.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
}

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  stripeClient = new Stripe(getRequiredSanitizedEnv('STRIPE_SECRET_KEY'), {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: parseNonNegativeInteger(process.env.STRIPE_MAX_NETWORK_RETRIES, DEFAULT_MAX_NETWORK_RETRIES),
    timeout: parsePositiveInteger(process.env.STRIPE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    appInfo: {
      name: 'KursNavi',
      url: 'https://kursnavi.ch',
    },
  });

  return stripeClient;
}

export function logStripeError(context, error) {
  console.error(context, {
    message: error?.message || null,
    type: error?.type || null,
    code: error?.code || null,
    statusCode: error?.statusCode || null,
    requestId: error?.requestId || error?.raw?.requestId || null,
    detail: error?.detail || error?.raw?.message || null,
  });
}

export function toStripeClientMessage(error, fallbackMessage) {
  if (error?.type === 'StripeConnectionError') {
    return 'Stripe ist gerade vorübergehend nicht erreichbar. Bitte versuche es in 1-2 Minuten erneut.';
  }

  if (error?.type === 'StripeAuthenticationError') {
    return 'Die Stripe-Verbindung ist aktuell nicht korrekt konfiguriert.';
  }

  return error?.message || fallbackMessage;
}
