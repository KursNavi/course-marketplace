export async function restoreRefundedFlexBooking({
  supabase,
  userId,
  courseId,
  paidAt,
  autoRefundUntil,
  payoutEligibleAt,
  stripePaymentIntentId = null,
  stripeCheckoutSessionId = null,
  ticketPeriodId = null,
  guardianAttestation = false,
  paidViaCredit = false,
  creditUsedCents = 0
}) {
  const { data: restoredBooking, error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      paid_at: paidAt.toISOString(),
      auto_refund_until: autoRefundUntil?.toISOString() || null,
      payout_eligible_at: payoutEligibleAt?.toISOString() || null,
      stripe_payment_intent_id: stripePaymentIntentId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      ticket_period_id: ticketPeriodId,
      guardian_attestation: !!guardianAttestation,
      paid_via_credit: !!paidViaCredit,
      credit_used_cents: creditUsedCents,
      refunded_at: null
    })
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .is('event_id', null)
    .eq('booking_type', 'platform_flex')
    .eq('status', 'refunded')
    .order('paid_at', { ascending: false })
    .limit(1)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return restoredBooking;
}
