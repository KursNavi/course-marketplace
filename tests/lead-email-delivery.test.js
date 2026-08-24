import { describe, it, expect } from 'vitest';
import {
  deliveryErrorCodeFromEvent,
  deliveryStatusFromResendEvent,
  providerMessageIdFromSendResult,
  shouldApplyDeliveryStatus,
} from '../api/_lib/lead-email-delivery.js';

describe('Lead-E-Mail-Zustellstatus', () => {
  it('liest die Resend-ID aus der normalen Send-Antwort', () => {
    expect(providerMessageIdFromSendResult({ data: { id: 'resend-1' } })).toBe('resend-1');
  });

  it('ordnet Resend-Ereignisse den internen Zuständen zu', () => {
    expect(deliveryStatusFromResendEvent('email.sent')).toBe('accepted');
    expect(deliveryStatusFromResendEvent('email.delivered')).toBe('delivered');
    expect(deliveryStatusFromResendEvent('email.bounced')).toBe('bounced');
    expect(deliveryErrorCodeFromEvent('email.bounced')).toBe('email.bounced');
    expect(deliveryErrorCodeFromEvent('email.delivered')).toBeNull();
  });

  it('verhindert, dass verspätete Ereignisse einen späteren Status zurücksetzen', () => {
    expect(shouldApplyDeliveryStatus('delivered', 'delivery_delayed')).toBe(false);
    expect(shouldApplyDeliveryStatus('accepted', 'delivered')).toBe(true);
    expect(shouldApplyDeliveryStatus('delivered', 'bounced')).toBe(true);
  });
});
