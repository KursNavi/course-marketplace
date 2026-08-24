export const RESEND_EVENT_STATUS = Object.freeze({
  'email.sent': 'accepted',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
});

// A later terminal result must not be overwritten by an earlier state that
// arrived out of order. Resend webhooks are at-least-once and not ordered.
const STATUS_RANK = Object.freeze({
  unknown: 0,
  pending: 0,
  accepted: 1,
  delivery_delayed: 1,
  delivered: 2,
  bounced: 3,
  complained: 3,
  failed: 3,
  suppressed: 3,
});

export function providerMessageIdFromSendResult(result) {
  return result?.data?.id || result?.id || null;
}

export function deliveryStatusFromResendEvent(eventType) {
  return RESEND_EVENT_STATUS[eventType] || null;
}

export function shouldApplyDeliveryStatus(currentStatus, incomingStatus) {
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const incomingRank = STATUS_RANK[incomingStatus] ?? 0;

  return incomingRank >= currentRank;
}

export function deliveryErrorCodeFromEvent(eventType) {
  return eventType && eventType !== 'email.delivered' ? eventType : null;
}
