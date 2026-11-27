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
 *  2b. Volljährigkeit (AGB 3.5 a, 27.11.2026): Selbstauskunft der aktuellen
 *     Regelversion muss beim Konto gespeichert sein (adultConfirmation.js),
 *     sonst 403 adult_confirmation_required; nicht prüfbar → 503. Bestehende
 *     Konten bestätigen einmal per POST { action: 'confirm_adult',
 *     confirmed: true, ruleVersion }. Geprüft VOR Bremse, Kontingent und Modell.
 *  3. Eingabe validieren (verbraucht nichts).
 *  3b. Missbrauchs-/Parallelitätsbremse (abuseGuard.js) vor jeder
 *     Reservierung und damit vor jedem kostenpflichtigen Aufruf.
 *  4. Atomare Reservierung (ai_search_quota_reserve, Advisory-Lock).
 *     'already_completed' → geschützter Wiederabruf des gespeicherten
 *     Ergebnisses (gleiches Konto + Inhalt, ohne Inferenz/Belastung).
 *  5. Suche (searchService.js). Luna/Embeddings nur, wenn openaiGateway
 *     readModelConfig() freigibt (Standard: aus, keine kostenpflichtigen Aufrufe).
 *  6. Abschluss (ai_search_quota_finalize); NUR 'completed' gibt das
 *     Ergebnis frei. Echter Systemfehler → Reservierung freigeben.
 *     Abschluss und private, befristete Speicherung laufen in EINER
 *     Datenbanktransaktion (ai_search_quota_finalize_and_store,
 *     Migration 20261121122101). Speicherfehler → nichts gezählt,
 *     Reservierung freigegeben, Fehler 500. Ohne Entwurf: Altzustand.
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
import { GUARD_LIMITS, evaluateGuard, storablePayload, isMissingFunction, isDefinitiveDbError } from '../src/lib/aiSearch/abuseGuard.js';
import { isPubliclySearchable } from '../src/lib/aiSearch/publication.js';
import { ADULT_RULE_VERSION, readAdultConfirmation, recordAdultConfirmation, validateAdultConfirmRequest } from '../src/lib/aiSearch/adultConfirmation.js';

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

// Rückgabewerte der atomaren Bremse im Migrationsentwurf (ai_search_quota_reserve v2).
const GUARD_RESERVE_CODES = new Set(['too_many_parallel', 'rate_limited', 'cooldown']);

/**
 * Abschluss + Speicherung atomar (Migration 20261121122101).
 *  - Erfolg: { finalized: 'completed', stored: true }
 *  - Speicher-/Datenbankfehler: { finalized: 'store_failed' } – nichts
 *    gezählt (Funktion zurückgerollt); Fehler wird protokolliert.
 *  - Übergangsbetrieb, solange die Funktion nicht existiert (Entwurf nicht
 *    angewendet): bisheriger Abschluss ohne Speicherung, stored: false.
 *    Das ist KEIN Speicherfehler, sondern der dokumentierte Altzustand.
 */
async function finalizeAndStore(service, requestId, userId, queryHash, payload) {
  let data;
  let error;
  try {
    ({ data, error } = await service.rpc('ai_search_quota_finalize_and_store', {
      p_request_id: requestId, p_user_id: userId, p_query_hash: queryHash, p_payload: payload, p_limit: QUOTA_LIMIT,
    }));
  } catch (thrown) {
    error = { message: String(thrown?.message ?? thrown), code: '' };
  }
  if (!error) return { finalized: data, stored: data === 'completed' };
  if (!isMissingFunction(error)) {
    if (!isDefinitiveDbError(error)) {
      // Zeitüberschreitung/verlorene Antwort: die Datenbank kann committed haben.
      console.error('ai-search: Abschluss/Speicherung – Ausgang unklar:', error.message);
      return { finalized: 'outcome_unknown', stored: false };
    }
    console.error('ai-search: Abschluss/Speicherung fehlgeschlagen:', error.message);
    return { finalized: 'store_failed', stored: false };
  }
  const legacy = await service.rpc('ai_search_quota_finalize', { p_request_id: requestId, p_limit: QUOTA_LIMIT });
  if (legacy.error) throw new Error(`Abschluss: ${legacy.error.message}`);
  return { finalized: legacy.data, stored: false };
}

/**
 * Klärt einen unklaren Abschluss nutzergebunden und idempotent:
 *  1. Freigabe versuchen – wirkt nur, solange die Zeile noch 'reserved' ist
 *     (Zeilensperre serialisiert mit einem eventuell noch laufenden
 *     Abschluss: entweder dieser gewinnt → 'completed', oder die Freigabe →
 *     der Abschluss findet danach 'not_reserved' und speichert nichts).
 *  2. Zustand der EIGENEN Zeile lesen: 'completed' = gezählt und gespeichert,
 *     'released' = endgültig nicht gezählt. Alles andere bleibt unklar.
 * @returns {Promise<'completed'|'released'|'unknown'>}
 */
async function resolveUnknownOutcome(service, requestId, userId) {
  try {
    const release = await service.rpc('ai_search_quota_release', { p_request_id: requestId });
    if (release.error && !isDefinitiveDbError(release.error)) return 'unknown';
    const { data, error } = await service.from('ai_search_usage')
      .select('state').eq('request_id', requestId).eq('user_id', userId).maybeSingle();
    if (error || !data) return 'unknown';
    return data.state === 'completed' || data.state === 'released' ? data.state : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Holt ein gespeichertes Ergebnis desselben Kontos/Suchinhalts, sonst null. */
async function fetchStoredResult(service, requestId, userId, queryHash) {
  const { data, error } = await service.rpc('ai_search_result_fetch', {
    p_request_id: requestId, p_user_id: userId, p_query_hash: queryHash,
  });
  if (error) {
    if (!isMissingFunction(error)) console.error('ai-search: Wiederabruf fehlgeschlagen:', error.message);
    return null;
  }
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

/**
 * Statusprüfung vor Ausgabe auch für gespeicherte Ergebnisse (Datenvertrag §1,
 * indexdesign.md „Kontingent“): Kurse, die seit der Suche nicht mehr
 * veröffentlicht sind, werden vor dem Wiederabruf entfernt. Nur ein lesender
 * Statusabgleich – keine neue Suche, keine Zählung, kein Modellaufruf.
 * Fehlt der Abgleich, wird nichts ausgeliefert (fail closed).
 * @returns {Promise<{payload: object, withdrawn: number} | null>} null = Abgleich nicht möglich
 */
export async function recheckStoredResult(service, payload) {
  const lists = ['results', 'incompleteResults'];
  const ids = [...new Set(lists.flatMap((key) => (Array.isArray(payload?.[key]) ? payload[key] : []).map((card) => card?.courseId))
    .filter((id) => id !== null && id !== undefined).map(String))];
  if (ids.length === 0) return { payload, withdrawn: 0 };
  const { data, error } = await service.from('courses').select('id, status').in('id', ids);
  if (error) {
    console.error('ai-search: Statusabgleich beim Wiederabruf fehlgeschlagen:', error.message);
    return null;
  }
  const fresh = new Map((data ?? []).map((row) => [String(row.id), row]));
  let withdrawn = 0;
  const next = { ...payload };
  for (const key of lists) {
    if (!Array.isArray(payload?.[key])) continue;
    next[key] = payload[key].filter((card) => {
      const keep = isPubliclySearchable(fresh.get(String(card?.courseId)));
      if (!keep) withdrawn += 1;
      return keep;
    });
  }
  return { payload: next, withdrawn };
}

async function quotaStatus(service, userId) {
  const { data, error } = await service.rpc('ai_search_quota_remaining', { p_user_id: userId, p_limit: QUOTA_LIMIT });
  if (error) throw new Error(`Kontingent lesen: ${error.message}`);
  return { limit: QUOTA_LIMIT, remaining: Number(data ?? 0), resetDate: quotaResetDate(new Date()) };
}

export default async function handler(req, res) {
  const requestStarted = Date.now();
  const serverTimings = {};
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
  const authStarted = Date.now();
  const { data: authData, error: authError } = await service.auth.getUser(token);
  serverTimings.auth = Date.now() - authStarted;
  const user = authData?.user;
  if (authError || !user) return res.status(401).json({ error: 'login_required' });
  if (user.is_anonymous === true) return res.status(403).json({ error: 'real_account_required' });

  try {
    // 2b. Volljährigkeit (Selbstauskunft der aktuellen Regelversion).
    const adult = await readAdultConfirmation(service, user.id);
    if (!adult.ok) console.error('ai-search: Volljährigkeit nicht prüfbar:', adult.error);

    if (req.method === 'GET') {
      const modelConfig = readModelConfig(process.env);
      return res.status(200).json({
        environment: environment.mode,
        models: { enabled: modelConfig.enabled, reason: modelConfig.reason, region: modelConfig.openaiRegion },
        adult: { confirmed: adult.ok && adult.confirmed, ruleVersion: ADULT_RULE_VERSION, ...(adult.ok ? {} : { unavailable: true }) },
        quota: await quotaStatus(service, user.id),
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

    // 2c. Einmalige Bestätigung bestehender Konten. Erfolg nur mit gespeichertem
    // und zurückgelesenem Eintrag; sonst bleibt die KI-Suche gesperrt.
    if (body.action === 'confirm_adult') {
      const invalid = validateAdultConfirmRequest(body);
      if (invalid) return res.status(400).json({ error: invalid, ruleVersion: ADULT_RULE_VERSION });
      const saved = await recordAdultConfirmation(service, user.id);
      if (!saved.ok) {
        console.error('ai-search: Bestätigung der Volljährigkeit nicht gespeichert:', saved.error);
        return res.status(503).json({ error: 'adult_confirmation_not_saved' });
      }
      return res.status(200).json({ adult: { confirmed: true, ruleVersion: saved.ruleVersion } });
    }
    if (body.action !== undefined) return res.status(400).json({ error: 'unknown_action' });

    // Ohne gespeicherte Bestätigung keine Suche (auch nicht bei direktem
    // API-Aufruf): nichts reserviert, nichts gezählt, kein Modellaufruf.
    if (!adult.ok) return res.status(503).json({ error: 'adult_check_unavailable' });
    if (!adult.confirmed) return res.status(403).json({ error: 'adult_confirmation_required', ruleVersion: ADULT_RULE_VERSION });

    // 3. Eingabe
    const queryError = validateQuery(body.query);
    if (queryError) return res.status(400).json({ error: queryError, quota: await quotaStatus(service, user.id) });
    if (typeof body.requestId !== 'string' || !UUID_RE.test(body.requestId)) {
      return res.status(400).json({ error: 'invalid_request_id' });
    }
    const musts = sanitizeMusts(body.musts);
    const queryHash = buildQueryHash(body.query, musts);

    // 3b. Missbrauchs-/Parallelitätsbremse VOR jeder Reservierung und damit
    // vor jedem kostenpflichtigen Aufruf (Plan 14, Schritt 3). Fällt die
    // Prüfung selbst aus, wird nicht gesucht (fail closed, nichts belastet).
    // Die eigene Kennung wird unabhängig von ihrem Alter mitgelesen: ein
    // Wiederabruf (auch nach mehr als einer Stunde) wird so VOR der Bremse
    // erkannt und nie gebremst.
    const guardStarted = Date.now();
    const sinceIso = new Date(Date.now() - GUARD_LIMITS.hourWindowMs).toISOString();
    const { data: recentRows, error: guardError } = await service
      .from('ai_search_usage')
      .select('request_id, state, created_at, reserved_until')
      .eq('user_id', user.id)
      .or(`created_at.gte."${sinceIso}",request_id.eq.${body.requestId}`)
      .order('created_at', { ascending: false })
      .limit(51);
    serverTimings.guard = Date.now() - guardStarted;
    if (guardError) {
      console.error('ai-search: Bremse nicht prüfbar:', guardError.message);
      return res.status(503).json({ error: 'guard_unavailable' });
    }
    const guard = evaluateGuard(recentRows, body.requestId, new Date());
    if (!guard.ok) {
      res.setHeader('Retry-After', String(guard.retryAfterSec));
      return res.status(429).json({ error: guard.code, retryAfterSec: guard.retryAfterSec, quota: await quotaStatus(service, user.id) });
    }

    // 4. Atomare Reservierung
    const reserveStarted = Date.now();
    const { data: reservation, error: reserveError } = await service.rpc('ai_search_quota_reserve', {
      p_user_id: user.id,
      p_request_id: body.requestId,
      p_query_hash: queryHash,
      p_limit: QUOTA_LIMIT,
    });
    serverTimings.reserve = Date.now() - reserveStarted;
    if (reserveError) throw new Error(`Reservierung: ${reserveError.message}`);

    if (reservation === 'limit_reached') {
      return res.status(429).json({ error: 'limit_reached', quota: await quotaStatus(service, user.id) });
    }
    if (reservation === 'request_mismatch') {
      return res.status(409).json({ error: 'request_mismatch' });
    }
    if (GUARD_RESERVE_CODES.has(reservation)) {
      // Atomare Bremse im Datenbankentwurf (gleiche Grenzwerte wie oben).
      return res.status(429).json({ error: reservation, quota: await quotaStatus(service, user.id) });
    }
    if (reservation === 'already_completed') {
      // Geschützter Wiederabruf (Plan 14, Schritt 3): dasselbe Konto, dieselbe
      // Kennung und derselbe Suchinhalt erhalten das gespeicherte Ergebnis –
      // ohne neue Inferenz und ohne neue Belastung. Fehlt es (abgelaufen oder
      // Speicher noch nicht eingerichtet), kein stiller kostenloser Neulauf.
      const restored = await fetchStoredResult(service, body.requestId, user.id, queryHash);
      if (restored) {
        // Erneute Statusprüfung: zurückgezogene Kurse fallen heraus (keine neue Suche).
        const checked = await recheckStoredResult(service, restored);
        if (!checked) return res.status(503).json({ error: 'guard_unavailable' });
        return res.status(200).json({ ...checked.payload, requestId: body.requestId, restored: true, withdrawnSinceSearch: checked.withdrawn, quota: await quotaStatus(service, user.id) });
      }
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
      ? {
        gateway: createOpenAiGateway({
          apiKey: process.env.OPENAI_API_KEY,
          region: modelConfig.openaiRegion,
          embeddingModel: modelConfig.embeddingModel,
          reasoningEffort: modelConfig.lunaReasoningEffort,
          batchSize: modelConfig.lunaBatchSize,
          distribution: modelConfig.lunaDistribution,
          mode: modelConfig.lunaMode,
          scoreSamples: modelConfig.lunaScoreSamples,
        }),
        embeddingVersion: modelConfig.embeddingVersion,
        semanticQuery: modelConfig.semanticQuery,
      }
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
    serverTimings.search = result.timings?.total ?? null;

    // 6. Abschluss UND Speicherung in EINER Datenbanktransaktion
    // (ai_search_quota_finalize_and_store): nur 'completed' gibt das
    // Ergebnis frei, und dann ist es auch gespeichert.
    const finalizeStarted = Date.now();
    let { finalized, stored } = await finalizeAndStore(service, body.requestId, user.id, queryHash, storablePayload(result));
    serverTimings.finalize = Date.now() - finalizeStarted;
    if (finalized === 'outcome_unknown') {
      // Kein vorschnelles „nicht gezählt“: Ausgang nutzergebunden klären.
      const resolved = await resolveUnknownOutcome(service, body.requestId, user.id);
      if (resolved === 'completed') {
        // Commit war erfolgreich, nur die Antwort ging verloren: gezählt und
        // gespeichert – das vorliegende Ergebnis ist genau das gespeicherte.
        finalized = 'completed';
        stored = true;
      } else if (resolved === 'released') {
        finalized = 'store_failed_released';
      } else {
        // Weiterhin unklar: Kennung behalten, keine Aussage über die Zählung.
        return res.status(503).json({ error: 'outcome_unknown' });
      }
    }
    if (finalized === 'store_failed_released') {
      return res.status(500).json({ error: 'store_failed', quota: await quotaStatus(service, user.id) });
    }
    if (finalized === 'store_failed') {
      // Speichern fehlgeschlagen → Transaktion zurückgerollt, Reservierung
      // offen: freigeben, damit keine verbrauchte Suche ohne Ergebnis bleibt.
      await service.rpc('ai_search_quota_release', { p_request_id: body.requestId });
      return res.status(500).json({ error: 'store_failed', quota: await quotaStatus(service, user.id) });
    }
    if (finalized !== 'completed') {
      return res.status(409).json({ error: 'not_released', quota: await quotaStatus(service, user.id) });
    }

    const quotaStarted = Date.now();
    const quota = await quotaStatus(service, user.id);
    serverTimings.quota = Date.now() - quotaStarted;
    serverTimings.total = Date.now() - requestStarted;
    // Nur Zahlen, keine Suchtexte (Nachtrag 11/12).
    console.log('ai-search timing+usage:', JSON.stringify({
      server: serverTimings,
      phases: result.timings,
      usage: models ? models.gateway.usage : null,
      luna: result.method.luna,
      semantic: result.method.semantic,
      region: models ? modelConfig.openaiRegion : null,
      effort: models ? modelConfig.lunaReasoningEffort : null,
      batch: models ? modelConfig.lunaBatchSize : null,
      distribution: models ? modelConfig.lunaDistribution : null,
      mode: models ? modelConfig.lunaMode : null,
      stats: result.stats,
    }));
    res.setHeader('Server-Timing', Object.entries(serverTimings).map(([name, ms]) => `${name};dur=${ms}`).join(', '));
    return res.status(200).json({ requestId: body.requestId, ...result, serverTimings, quota, restorable: stored });
  } catch (error) {
    console.error('ai-search error:', error?.message);
    return res.status(500).json({ error: 'server_error' });
  }
}
