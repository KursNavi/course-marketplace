/**
 * Such-API der KI-Suche (S03) — Preview-Stufe.
 *
 *   GET  /api/ai-search            → Kontingentstatus (verbraucht nichts)
 *   POST /api/ai-search            → neue KI-Suche (zählt einmal)
 *        Body: { query, requestId, musts?: { canton, onlineAllowed, maxBudget } }
 *
 * Reihenfolge der Prüfungen (Nachtrag 07, Datenvertrag §7/§8):
 *  1. Umgebung: nur ausserhalb der Vercel-Produktion und nur gegen die
 *     TESTumgebung KursNavi (previewGuard.js) — sonst Ablehnung ohne Datenzugriff.
 *  2. Konto: verifizierte Supabase-Sitzung; fehlend/ungültig/abgelaufen/
 *     anonym → 401/403. Nutzerkennung nur aus der verifizierten Sitzung.
 *  3. Eingabe validieren (verbraucht nichts).
 *  4. Atomare Reservierung (ai_search_quota_reserve, Advisory-Lock).
 *  5. Suche (searchService.js). Luna/Embeddings nur, wenn openaiGateway
 *     readModelConfig() freigibt (Standard: aus, keine kostenpflichtigen Aufrufe).
 *  6. Abschluss (ai_search_quota_finalize); NUR 'completed' gibt das
 *     Ergebnis frei. Echter Systemfehler → Reservierung freigeben.
 *
 * Rohsuchtexte werden nicht protokolliert.
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { checkAiSearchEnvironment } from '../src/lib/aiSearch/previewGuard.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { normalizeQuery, validateQuery } from '../src/lib/aiSearch/queryParse.js';
import { QUOTA_LIMIT, quotaResetDate } from '../src/lib/aiSearch/quota.js';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeMusts(raw) {
  const musts = {};
  if (raw && typeof raw === 'object') {
    if (typeof raw.canton === 'string' && raw.canton.trim() && raw.canton.length <= 40) {
      musts.canton = raw.canton.trim();
      musts.onlineAllowed = raw.onlineAllowed === true;
    }
    const budget = Number(raw.maxBudget);
    if (raw.maxBudget !== undefined && raw.maxBudget !== null && raw.maxBudget !== '' && Number.isFinite(budget) && budget > 0 && budget <= 100000) {
      musts.maxBudget = Math.round(budget);
    }
  }
  return musts;
}

/** Bindet die request_id an den Suchinhalt (Anfrage + Muss-Vorgaben). */
export function buildQueryHash(query, musts) {
  return createHash('sha256')
    .update(JSON.stringify({ q: normalizeQuery(query).toLowerCase(), m: musts }))
    .digest('hex');
}

async function quotaStatus(service, userId) {
  const { data, error } = await service.rpc('ai_search_quota_remaining', { p_user_id: userId, p_limit: QUOTA_LIMIT });
  if (error) throw new Error(`Kontingent lesen: ${error.message}`);
  return { limit: QUOTA_LIMIT, remaining: Number(data ?? 0), resetDate: quotaResetDate(new Date()) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 1. Umgebung (vor jedem Datenzugriff)
  const environment = checkAiSearchEnvironment(process.env);
  if (!environment.ok) {
    return res.status(environment.code === 'not_available' ? 404 : 503).json({ error: environment.code, message: environment.reason });
  }

  const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Konto
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'login_required' });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return res.status(401).json({ error: 'login_required' });
  if (user.is_anonymous === true) return res.status(403).json({ error: 'real_account_required' });

  try {
    if (req.method === 'GET') {
      const modelConfig = readModelConfig(process.env);
      return res.status(200).json({
        environment: 'test',
        models: { enabled: modelConfig.enabled, reason: modelConfig.reason },
        quota: await quotaStatus(service, user.id),
      });
    }

    // 3. Eingabe
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const queryError = validateQuery(body.query);
    if (queryError) return res.status(400).json({ error: queryError, quota: await quotaStatus(service, user.id) });
    if (typeof body.requestId !== 'string' || !UUID_RE.test(body.requestId)) {
      return res.status(400).json({ error: 'invalid_request_id' });
    }
    const musts = sanitizeMusts(body.musts);
    const queryHash = buildQueryHash(body.query, musts);

    // 4. Atomare Reservierung
    const { data: reservation, error: reserveError } = await service.rpc('ai_search_quota_reserve', {
      p_user_id: user.id,
      p_request_id: body.requestId,
      p_query_hash: queryHash,
      p_limit: QUOTA_LIMIT,
    });
    if (reserveError) throw new Error(`Reservierung: ${reserveError.message}`);

    if (reservation === 'limit_reached') {
      return res.status(429).json({ error: 'limit_reached', quota: await quotaStatus(service, user.id) });
    }
    if (reservation === 'request_mismatch') {
      return res.status(409).json({ error: 'request_mismatch' });
    }
    if (reservation === 'already_completed') {
      // Ergebnisse werden in der Preview nicht serverseitig gespeichert:
      // kein stiller kostenloser Neulauf — neue (zählende) Suche anbieten.
      return res.status(409).json({ error: 'result_not_stored', quota: await quotaStatus(service, user.id) });
    }
    if (reservation === 'already_reserved') {
      return res.status(409).json({ error: 'in_progress' });
    }
    if (reservation !== 'reserved') {
      return res.status(409).json({ error: 'request_closed', quota: await quotaStatus(service, user.id) });
    }

    // 5. Suche
    let result;
    // Modellaufrufe (Luna, Embeddings) nur nach Freigabe E3 — sonst null.
    const modelConfig = readModelConfig(process.env);
    const models = modelConfig.enabled
      ? { gateway: createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: modelConfig.embeddingModel }), embeddingVersion: modelConfig.embeddingVersion }
      : null;
    try {
      result = await runAiSearch(service, { query: body.query, musts, models });
    } catch (searchError) {
      // Echter Systemfehler (auch Modellfehler): Reservierung freigeben, die
      // Suche zählt nicht. Kein stiller Rückfall auf simulierte Ergebnisse.
      await service.rpc('ai_search_quota_release', { p_request_id: body.requestId });
      console.error('ai-search: Suche fehlgeschlagen:', searchError?.message);
      if (models) console.log('ai-search usage (fehlgeschlagen):', JSON.stringify(models.gateway.usage));
      return res.status(502).json({ error: 'search_failed', modelsEnabled: Boolean(models), quota: await quotaStatus(service, user.id) });
    }
    // Nur Zahlen, keine Suchtexte.
    if (models) console.log('ai-search usage:', JSON.stringify({ ...models.gateway.usage, luna: result.method.luna, semantic: result.method.semantic }));

    // 6. Abschluss — nur 'completed' gibt das Ergebnis frei.
    const { data: finalized, error: finalizeError } = await service.rpc('ai_search_quota_finalize', {
      p_request_id: body.requestId,
      p_limit: QUOTA_LIMIT,
    });
    if (finalizeError) throw new Error(`Abschluss: ${finalizeError.message}`);
    if (finalized !== 'completed') {
      return res.status(409).json({ error: 'not_released', quota: await quotaStatus(service, user.id) });
    }

    return res.status(200).json({ requestId: body.requestId, ...result, quota: await quotaStatus(service, user.id) });
  } catch (error) {
    console.error('ai-search error:', error?.message);
    return res.status(500).json({ error: 'server_error' });
  }
}
