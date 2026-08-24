import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  deliveryErrorCodeFromEvent,
  deliveryStatusFromResendEvent,
  shouldApplyDeliveryStatus,
} from './_lib/lead-email-delivery.js';

// Resend signatures must be verified against the untouched request body.
export const config = { api: { bodyParser: false } };

function headerValue(req, name) {
  const headers = req?.headers;
  if (headers?.get) return headers.get(name);
  return headers?.[name] || headers?.[name.toLowerCase()] || null;
}

async function readRawBody(req) {
  if (typeof req?.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req?.rawBody)) return req.rawBody.toString('utf8');
  if (typeof req?.body === 'string') return req.body;
  if (Buffer.isBuffer(req?.body)) return req.body.toString('utf8');

  if (!req || typeof req[Symbol.asyncIterator] !== 'function') {
    throw new Error('raw_webhook_body_unavailable');
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    console.error('resend-webhook: RESEND_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ error: 'Webhook is not configured' });
  }

  const id = headerValue(req, 'svix-id');
  const timestamp = headerValue(req, 'svix-timestamp');
  const signature = headerValue(req, 'svix-signature');
  if (!id || !timestamp || !signature) {
    return res.status(400).json({ error: 'Missing webhook signature headers' });
  }

  let event;
  try {
    const payload = await readRawBody(req);
    const resend = new Resend(process.env.RESEND_API_KEY || 'webhook-verifier');
    event = await resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch (error) {
    console.error('resend-webhook: signature verification failed:', error?.message || 'unknown error');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const deliveryStatus = deliveryStatusFromResendEvent(event?.type);
  const providerMessageId = event?.data?.email_id;
  if (!deliveryStatus || !providerMessageId) {
    return res.status(200).json({ received: true, matched: false });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('resend-webhook: Supabase configuration is missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: lead, error: lookupError } = await supabase
    .from('leads')
    .select('id, email_delivery_status')
    .eq('email_provider_message_id', providerMessageId)
    .maybeSingle();

  if (lookupError) {
    console.error('resend-webhook: lead lookup failed:', lookupError.message);
    return res.status(500).json({ error: 'Lead lookup failed' });
  }

  // A webhook can arrive for an email that predates this tracking field. It is
  // still acknowledged so Resend does not retry an event we cannot associate.
  if (!lead) {
    return res.status(200).json({ received: true, matched: false });
  }

  if (!shouldApplyDeliveryStatus(lead.email_delivery_status, deliveryStatus)) {
    return res.status(200).json({ received: true, matched: true, updated: false });
  }

  const eventTimestamp = event?.created_at || new Date().toISOString();
  const { error: updateError } = await supabase
    .from('leads')
    .update({
      email_delivery_status: deliveryStatus,
      email_delivery_updated_at: eventTimestamp,
      email_delivery_error_code: deliveryErrorCodeFromEvent(event.type),
    })
    .eq('id', lead.id);

  if (updateError) {
    console.error('resend-webhook: lead update failed:', updateError.message);
    return res.status(500).json({ error: 'Lead update failed' });
  }

  return res.status(200).json({ received: true, matched: true, updated: true });
}
