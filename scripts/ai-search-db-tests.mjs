/**
 * Echte Datenbanktests für die KI-Such-Grundlage (Quota, Rollen, Abruf).
 *
 * AUSFÜHRUNG ERST NACH FREIGABE E5 — ausschliesslich gegen das freigegebene
 * Supabase-TESTprojekt "TESTumgebung KursNavi" (Referenz omoapbvfligjfznzivyu).
 * Das Skript verweigert jeden Lauf gegen eine andere Adresse — insbesondere
 * gegen Produktion. Benötigt (wie scripts/seed-e2e.mjs):
 *   SUPABASE_URL_TEST, SUPABASE_SECRET_KEY_TEST, SUPABASE_PUBLISHABLE_KEY_TEST
 * sowie zuvor angewendete Migrationen 20261113180000/180100/180200.
 *
 * Abgedeckt (Nachtrag 07 §4 und Prüfbefunde):
 *   1. Rollen/RLS: anon darf weder ai_search_*-Tabellen lesen noch
 *      Quota-Funktionen ausführen.
 *   2. Limit: 10 Reservierungen erlaubt, die elfte blockiert.
 *   3. Parallelität: 15 gleichzeitige Reservierungen → exakt 10 erfolgreich.
 *   4. Idempotenz: gleichzeitige identische request_id → genau 1x reserved;
 *      fremder Nutzer/anderer Inhalt → request_mismatch.
 *   5. Ablauf/später Abschluss: abgelaufene Reservierung + volles Limit →
 *      finalize = rejected_expired (kein elftes Ergebnis), Zählung exakt 10.
 *   6. Monatsgrenze: ai_search_month_key an UTC-Randzeitpunkten (inkl. DST).
 *   7. Ablauf-Semantik NUR auf eigenen Zeilen (ohne globalen Cleanup).
 *
 * Datensicherheit:
 *   - Sämtliche Schreibzugriffe betreffen ausschliesslich Zeilen mit eigenen,
 *     frisch erzeugten Zufalls-UUIDs (eigene user_ids/request_ids).
 *   - Der GLOBALE Cleanup (ai_search_quota_cleanup) wird standardmässig NICHT
 *     aufgerufen, weil er abgelaufene Reservierungen FREMDER parallel laufender
 *     Tests freigeben würde. Sein gezielter Test erfordert eine vollständig
 *     isolierte, entbehrliche Umgebung und das explizite Flag
 *     AI_DB_TESTS_ALLOW_GLOBAL_CLEANUP=1.
 *   - Aufräumen der eigenen Testdaten läuft in einem finally-Block und damit
 *     auch bei Testfehlern oder Abbrüchen.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_REF = 'nplxmpfasgpumpiddjfl';
export const EXPECTED_TEST_REF = 'omoapbvfligjfznzivyu'; // "TESTumgebung KursNavi"
export const REQUIRED_ENV = ['SUPABASE_URL_TEST', 'SUPABASE_SECRET_KEY_TEST', 'SUPABASE_PUBLISHABLE_KEY_TEST'];

/**
 * Strikte Zieladressprüfung mit echtem URL-Parser (WHATWG URL).
 *
 * Erlaubt ist AUSSCHLIESSLICH exakt `https://omoapbvfligjfznzivyu.supabase.co`
 * (optional mit blossem '/'-Pfad). Abgelehnt werden: anderes Protokoll,
 * anderer Hostname (inkl. täuschender Aufbauten wie
 * `https://omoapbvfligjfznzivyu.supabase.co@evil.com` — dort ist der Teil vor
 * dem @ Benutzerinformation und der echte Host evil.com), Benutzername/
 * Passwort in der URL, explizite Ports, Pfade, Abfrageparameter und Fragmente.
 *
 * @returns {{ok: boolean, reason: string|null, ref: string|null}}
 */
export function checkTargetUrl(rawUrl, expectedRef = EXPECTED_TEST_REF) {
  const expectedHost = `${expectedRef}.supabase.co`;
  let parsed;
  try {
    parsed = new URL(String(rawUrl ?? '').trim());
  } catch {
    return { ok: false, reason: 'keine gültige URL', ref: null };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `Protokoll "${parsed.protocol}" abgelehnt — nur https:`, ref: null };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Benutzerinformationen in der URL abgelehnt', ref: null };
  }
  if (parsed.port !== '') {
    return { ok: false, reason: `expliziter Port "${parsed.port}" abgelehnt`, ref: null };
  }
  if (parsed.hostname !== expectedHost) {
    const reason = parsed.hostname === `${PRODUCTION_REF}.supabase.co`
      ? 'Hostname ist das PRODUKTIONSprojekt. Niemals dort testen.'
      : `Hostname "${parsed.hostname}" abgelehnt — erlaubt ist ausschliesslich "${expectedHost}" (TESTumgebung KursNavi)`;
    return { ok: false, reason, ref: null };
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return { ok: false, reason: `Pfad "${parsed.pathname}" abgelehnt`, ref: null };
  }
  if (parsed.search !== '') {
    return { ok: false, reason: 'Abfrageparameter abgelehnt', ref: null };
  }
  if (parsed.hash !== '') {
    return { ok: false, reason: 'Fragment abgelehnt', ref: null };
  }
  return { ok: true, reason: null, ref: expectedRef };
}

/**
 * Zielprüfung VOR jeder Ausführung: Die konfigurierte Testadresse muss exakt
 * dem freigegebenen Testprojekt entsprechen. Reiner, lokal testbarer Guard.
 * @returns {{ok: boolean, reason: string|null}}
 */
export function checkTestTarget(env, expectedRef = EXPECTED_TEST_REF) {
  const missing = REQUIRED_ENV.filter((key) => !env?.[key]);
  if (missing.length > 0) {
    return { ok: false, reason: `fehlende Testprojekt-Umgebungsvariablen: ${missing.join(', ')}` };
  }
  const target = checkTargetUrl(env.SUPABASE_URL_TEST, expectedRef);
  if (!target.ok) {
    return { ok: false, reason: `SUPABASE_URL_TEST: ${target.reason}` };
  }
  return { ok: true, reason: null };
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) {
    console.error(`Abbruch: ${guard.reason}`);
    console.error('Dieses Skript läuft erst nach Freigabe E5 gegen das Supabase-TESTprojekt.');
    process.exit(2);
  }

  const url = process.env.SUPABASE_URL_TEST;
  const service = createClient(url, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });
  const anon = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY_TEST, { auth: { persistSession: false } });

  let failures = 0;
  const createdUsers = [];

  const check = (name, condition, detail = '') => {
    if (condition) {
      console.log(`  ok    ${name}`);
    } else {
      failures += 1;
      console.error(`  FEHLER ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };

  const reserve = (client, userId, requestId, queryHash, limit = 10) => client.rpc('ai_search_quota_reserve', {
    p_user_id: userId, p_request_id: requestId, p_query_hash: queryHash, p_limit: limit,
  });

  console.log(`KI-Such-DB-Tests gegen Projekt ${EXPECTED_TEST_REF} (TESTumgebung KursNavi)`);

  try {
    // --- 1. Rollen/RLS -------------------------------------------------------
    console.log('1. Rollen und Zugriffsrechte');
    for (const table of ['ai_search_usage', 'ai_search_documents', 'ai_search_chunks', 'ai_search_jobs', 'ai_search_config']) {
      const { data, error } = await anon.from(table).select('*').limit(1);
      check(`anon kann ${table} nicht lesen`, Boolean(error) || (data ?? []).length === 0,
        error ? '' : 'SELECT lieferte Zeilen');
    }
    {
      const { error } = await reserve(anon, randomUUID(), randomUUID(), 'h');
      check('anon kann ai_search_quota_reserve nicht ausführen', Boolean(error));
    }

    // --- 2. Limit: 10 erlaubt, 11. blockiert --------------------------------
    console.log('2. Zehnerlimit');
    const userA = randomUUID();
    createdUsers.push(userA);
    for (let i = 1; i <= 10; i += 1) {
      const { data, error } = await reserve(service, userA, randomUUID(), 'h');
      check(`Reservierung ${i} erlaubt`, !error && data === 'reserved', error?.message ?? data);
    }
    {
      const { data } = await reserve(service, userA, randomUUID(), 'h');
      check('11. Reservierung blockiert', data === 'limit_reached', String(data));
    }
    {
      const { data } = await service.rpc('ai_search_quota_remaining', { p_user_id: userA, p_limit: 10 });
      check('Restanzeige 0', data === 0, String(data));
    }

    // --- 3. Parallelität -----------------------------------------------------
    console.log('3. Parallelität: 15 gleichzeitige Reservierungen → exakt 10');
    const userB = randomUUID();
    createdUsers.push(userB);
    const parallel = await Promise.all(
      Array.from({ length: 15 }, () => reserve(service, userB, randomUUID(), 'h')),
    );
    const reservedCount = parallel.filter((r) => r.data === 'reserved').length;
    const limitCount = parallel.filter((r) => r.data === 'limit_reached').length;
    const errorCount = parallel.filter((r) => r.error).length;
    check('genau 10 reserviert', reservedCount === 10, `reserved=${reservedCount}`);
    check('restliche 5 limit_reached, keine Fehler', limitCount === 5 && errorCount === 0,
      `limit=${limitCount} errors=${errorCount}`);

    // --- 4. Idempotenz und Bindung ------------------------------------------
    console.log('4. Idempotente request_id und Bindung an Nutzer/Inhalt');
    const userC = randomUUID();
    createdUsers.push(userC);
    const sharedRequest = randomUUID();
    const identical = await Promise.all(
      Array.from({ length: 5 }, () => reserve(service, userC, sharedRequest, 'hash-x')),
    );
    const okOne = identical.filter((r) => r.data === 'reserved').length;
    const already = identical.filter((r) => typeof r.data === 'string' && r.data.startsWith('already_')).length;
    check('identische Parallel-Anfragen: genau 1x reserved, Rest already_*',
      okOne === 1 && already === 4 && identical.every((r) => !r.error),
      identical.map((r) => r.error?.message ?? r.data).join(','));
    {
      const { data } = await reserve(service, userC, sharedRequest, 'hash-anders');
      check('veränderter Suchinhalt mit derselben ID → request_mismatch', data === 'request_mismatch', String(data));
    }
    {
      const foreignUser = randomUUID();
      createdUsers.push(foreignUser); // defensiv, falls doch eine Zeile entstünde
      const { data } = await reserve(service, foreignUser, sharedRequest, 'hash-x');
      check('fremder Nutzer mit derselben ID → request_mismatch', data === 'request_mismatch', String(data));
    }

    // --- 5. Ablauf und später Abschluss --------------------------------------
    console.log('5. Ablauf, Ersatzvergabe, später Abschluss (kein elftes Ergebnis)');
    const userD = randomUUID();
    createdUsers.push(userD);
    const oldRequest = randomUUID();
    await reserve(service, userD, oldRequest, 'h');
    // NUR die eigene Zeile künstlich ablaufen lassen (request_id-gebunden):
    await service.from('ai_search_usage')
      .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
      .eq('request_id', oldRequest)
      .eq('user_id', userD);
    for (let i = 1; i <= 10; i += 1) {
      const requestId = randomUUID();
      await reserve(service, userD, requestId, 'h');
      await service.rpc('ai_search_quota_finalize', { p_request_id: requestId, p_limit: 10 });
    }
    {
      const { data } = await service.rpc('ai_search_quota_finalize', { p_request_id: oldRequest, p_limit: 10 });
      check('später Abschluss der abgelaufenen Reservierung → rejected_expired (Ergebnis wird nicht freigegeben)',
        data === 'rejected_expired', String(data));
    }
    {
      const { count } = await service.from('ai_search_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userD).eq('state', 'completed');
      check('exakt 10 completed (= maximal auslieferbare Ergebnisse), nie 11', count === 10, String(count));
    }

    // --- 6. Monatsgrenze (Europe/Zurich, inkl. DST) --------------------------
    console.log('6. Monatsgrenze Europe/Zurich');
    const monthCases = [
      ['2026-11-30T23:30:00Z', '2026-12'],
      ['2026-11-30T22:30:00Z', '2026-11'],
      ['2027-07-31T22:30:00Z', '2027-08'],
      ['2027-07-31T21:30:00Z', '2027-07'],
    ];
    for (const [at, expected] of monthCases) {
      const { data } = await service.rpc('ai_search_month_key', { p_at: at });
      check(`month_key(${at}) = ${expected}`, data === expected, String(data));
    }

    // --- 7. Ablauf-Semantik nur auf eigenen Zeilen ---------------------------
    console.log('7. Abgelaufene eigene Reservierung gibt das Kontingent frei (ohne globalen Cleanup)');
    const userE = randomUUID();
    createdUsers.push(userE);
    const orphan = randomUUID();
    await reserve(service, userE, orphan, 'h');
    await service.from('ai_search_usage')
      .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
      .eq('request_id', orphan)
      .eq('user_id', userE);
    {
      // Abgelaufene Reservierungen zaehlen nicht mehr — ohne jeden Cleanup:
      const { data } = await service.rpc('ai_search_quota_remaining', { p_user_id: userE, p_limit: 10 });
      check('Kontingent nach Ablauf wieder frei (Zählung ignoriert Abgelaufenes)', data === 10, String(data));
    }

    if (process.env.AI_DB_TESTS_ALLOW_GLOBAL_CLEANUP === '1') {
      // ACHTUNG: wirkt GLOBAL auf alle abgelaufenen Reservierungen des
      // Projekts. Nur in einer vollständig isolierten, entbehrlichen
      // Umgebung ausführen (explizit per Flag angefordert).
      console.log('7b. GLOBALER Cleanup (Flag gesetzt — isolierte Wegwerfumgebung vorausgesetzt)');
      const { data } = await service.rpc('ai_search_quota_cleanup');
      check('Cleanup gibt mindestens die eigene verwaiste Reservierung frei', (data ?? 0) >= 1, String(data));
    } else {
      console.log('7b. GLOBALER Cleanup übersprungen (AI_DB_TESTS_ALLOW_GLOBAL_CLEANUP nicht gesetzt) — '
        + 'er würde fremde abgelaufene Reservierungen mitverändern.');
    }
  } finally {
    // Aufräumen der EIGENEN Testdaten — läuft auch bei Fehlern/Abbrüchen.
    try {
      const { error: cleanupError, count } = await service
        .from('ai_search_usage')
        .delete({ count: 'exact' })
        .in('user_id', createdUsers);
      console.log(`Cleanup: ${count ?? 0} Testzeilen für ${createdUsers.length} Testnutzer gelöscht${cleanupError ? ` (FEHLER: ${cleanupError.message})` : ''}`);
      if (cleanupError) failures += 1;
      if (!cleanupError) {
        const { count: residual } = await service
          .from('ai_search_usage')
          .select('*', { count: 'exact', head: true })
          .in('user_id', createdUsers);
        if ((residual ?? 0) > 0) {
          failures += 1;
          console.error(`FEHLER Cleanup unvollständig: ${residual} Zeilen verblieben.`);
        }
      }
    } catch (cleanupException) {
      failures += 1;
      console.error('FEHLER beim Cleanup:', cleanupException);
    }
  }

  console.log(failures === 0 ? '\nAlle DB-Tests bestanden.' : `\n${failures} DB-Test(s) FEHLGESCHLAGEN.`);
  process.exit(failures === 0 ? 0 : 1);
}

// Nur bei direktem Aufruf ausführen; Importe (Unit-Tests der Guards) starten nichts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Unerwarteter Fehler:', error);
    process.exit(1);
  });
}
