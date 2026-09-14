import { createClient } from '@supabase/supabase-js';
import { LEAD_ACTIONS, verifyLeadActionToken } from './_lib/lead-action-token.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlPage(title, content) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | KursNavi</title></head><body style="margin:0;background:#f6f1ea;font-family:Arial,sans-serif;color:#1f2937"><main style="max-width:560px;margin:64px auto;padding:32px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08)"><h1 style="color:#FA6E28">${escapeHtml(title)}</h1>${content}</main></body></html>`;
}

function sendHtml(res, status, title, content) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(htmlPage(title, content));
}

function readParams(req) {
  const source = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  return {
    leadId: String(source.lead || ''),
    action: String(source.action || ''),
    expiresAt: String(source.expires || ''),
    token: String(source.token || ''),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = readParams(req);
  const secret = process.env.LEAD_ACTION_SECRET;
  const valid = verifyLeadActionToken({ ...params, secret });
  if (!valid) {
    return sendHtml(res, 403, 'Link nicht gültig', '<p>Dieser Status-Link ist abgelaufen oder ungültig. Öffne bitte dein KursNavi-Dashboard.</p>');
  }

  if (req.method === 'GET') {
    const hidden = Object.entries({
      lead: params.leadId,
      action: params.action,
      expires: params.expiresAt,
      token: params.token,
    }).map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`).join('');
    return sendHtml(
      res,
      200,
      'Anfragestatus bestätigen',
      `<p>Du möchtest die Anfrage als <strong>${escapeHtml(LEAD_ACTIONS[params.action])}</strong> markieren.</p><form method="post">${hidden}<button type="submit" style="border:0;border-radius:10px;background:#FA6E28;color:white;padding:14px 20px;font-weight:700;cursor:pointer">Status bestätigen</button></form><p style="margin-top:20px;font-size:13px;color:#6b7280">Die zusätzliche Bestätigung verhindert, dass E-Mail-Sicherheitsprüfungen den Status unbeabsichtigt ändern.</p>`
    );
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();
  const updates = { response_status: params.action };
  if (params.action === 'acknowledged') updates.acknowledged_at = now;
  if (params.action === 'qualified') {
    updates.acknowledged_at = now;
    updates.qualified_at = now;
  }
  if (params.action === 'not_qualified') updates.acknowledged_at = now;
  if (params.action === 'contacted') {
    updates.acknowledged_at = now;
    updates.contacted_at = now;
  }

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', params.leadId)
    .select('id, response_status')
    .single();

  if (error || !data) {
    console.error('lead-action update failed:', error?.message || 'lead not found');
    return sendHtml(res, 500, 'Status nicht gespeichert', '<p>Bitte versuche es später erneut oder öffne dein KursNavi-Dashboard.</p>');
  }

  return sendHtml(
    res,
    200,
    'Status gespeichert',
    `<p>Die Anfrage wurde als <strong>${escapeHtml(LEAD_ACTIONS[params.action])}</strong> markiert.</p><p>Danke – diese Rückmeldung hilft KursNavi, Anfragen und Anbieter besser zusammenzubringen.</p><p><a href="/dashboard" style="color:#FA6E28;font-weight:700">Zum Dashboard</a></p>`
  );
}
