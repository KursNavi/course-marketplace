/**
 * Echte Datenbanktests für die KI-Such-Grundlage (Quota, Rollen, Abruf).
 *
 * AUSFÜHRUNG ERST NACH FREIGABE E5 — ausschliesslich gegen das freigegebene
 * Supabase-TESTprojekt "TESTumgebung KursNavi" (Referenz omoapbvfligjfznzivyu).
 * Das Skript verweigert jeden Lauf gegen eine andere Adresse — insbesondere
 * gegen Produktion. Benötigt (wie scripts/seed-e2e.mjs):
 *   SUPABASE_URL_TEST, SUPABASE_SECRET_KEY_TEST, SUPABASE_PUBLISHABLE_KEY_TEST
 * sowie zuvor angewendete Migrationen 20261114205850/205915/205947.
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
 *   8. Outbox-Worker: eigene synthetische Jobs (nicht existente Kurs-IDs)
 *      werden koalesziert verarbeitet und abgeschlossen; echte Kurse und
 *      fremde Jobs bleiben unberührt (onlyCourseIds-Filter).
 *   9. Atomare Übernahme (Migration 20261115200229) am EIGENEN Testkurs:
 *      Trigger→Worker→Indexeintrag, zwei gleichzeitige Übernahmen mit
 *      unterschiedlicher Version, Rücknahme gegen verspäteten älteren
 *      Upsert (Tombstone), Reparatur eines unvollständigen Bestands.
 *      Ist die Migration nicht angewendet, werden 8./9. ausdrücklich als
 *      NICHT GEPRÜFT ausgewiesen (kein stilles Grün).
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
import { processOutboxBatch, loadCourseSource } from '../src/lib/aiSearch/worker.js';
import { verifyCourseChunks } from '../src/lib/aiSearch/reconciliation.js';
import { buildProjection } from '../src/lib/aiSearch/projection.js';
import { isMissingFunction } from '../src/lib/aiSearch/abuseGuard.js';

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
  let workerApplyAvailable = false;
  const createdUsers = [];
  const createdCourseIds = [];
  const createdJobCourseIds = [];
  // Eigene, garantiert nicht existente Kurs-IDs für Worker-Jobtests
  // (ai_search_jobs hat bewusst keinen FK auf courses; weit ausserhalb
  // realer ID-Bereiche, aber Number-sicher):
  const fakeCourseId = () => 900_000_000_000_000 + Math.floor(Math.random() * 1_000_000_000);

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

  // Migration 20261121122101 (Ergebnisspeicher + atomare Bremse) angewendet?
  // Dann gelten Parallel-/Minutengrenzen auch für diese Tests: eigene Zeilen
  // werden zwischen den Kontingentschritten gezielt „gealtert“.
  // Nur „Funktion existiert nicht“ (PGRST202/42883) gilt als nicht angewendet.
  // Rechte-, Transport- oder andere Fehler werden NICHT als fehlendes Schema
  // verschluckt, sondern brechen den Lauf als Fehler ab.
  let guardAvailable = false;
  {
    const { error } = await service.rpc('ai_search_result_fetch', { p_request_id: randomUUID(), p_user_id: randomUUID(), p_query_hash: 'probe' });
    if (!error) {
      guardAvailable = true;
    } else if (!isMissingFunction(error)) {
      console.error(`FEHLER Verfügbarkeitsprüfung Ergebnisspeicher: ${error.code || '-'} ${error.message}`);
      process.exit(1);
    }
  }
  // Nach Anwendung der Migration ist ein übersprungener Abschnitt 10 kein Erfolg.
  if (process.env.AI_DB_TESTS_REQUIRE_RESULT_STORE === '1' && !guardAvailable) {
    console.error('FEHLER: AI_DB_TESTS_REQUIRE_RESULT_STORE=1, aber ai_search_result_fetch fehlt – Abschnitt 10 würde übersprungen.');
    process.exit(1);
  }
  const createdAuthUsers = [];
  // Nur eigene Testzeilen (user_id) zurückdatieren: nicht mehr „laufend“ und
  // nicht mehr in der Minuten-/Stundenzählung der Bremse.
  const ageOwnRows = async (userId) => {
    if (!guardAvailable) return;
    const { error } = await service.from('ai_search_usage')
      .update({ created_at: new Date(Date.now() - 2 * 3_600_000).toISOString() })
      .eq('user_id', userId);
    if (error) throw new Error(`Testzeilen altern: ${error.message}`);
  };
  console.log(`Bremse/Ergebnisspeicher (Migration 20261121122101): ${guardAvailable ? 'angewendet' : 'nicht angewendet'}`);

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
      await ageOwnRows(userA);
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
    if (!guardAvailable) {
      check('genau 10 reserviert', reservedCount === 10, `reserved=${reservedCount}`);
      check('restliche 5 limit_reached, keine Fehler', limitCount === 5 && errorCount === 0,
        `limit=${limitCount} errors=${errorCount}`);
    } else {
      // Mit Bremse: höchstens ein laufender Auftrag je Konto, auch bei 15
      // gleichzeitigen Anfragen (Serialisierung unter dem Nutzer-Lock).
      const parallelBlocked = parallel.filter((r) => r.data === 'too_many_parallel').length;
      check('Bremse: von 15 gleichzeitigen genau 1 reserviert, 14 too_many_parallel, keine Fehler',
        reservedCount === 1 && parallelBlocked === 14 && errorCount === 0,
        `reserved=${reservedCount} parallel=${parallelBlocked} errors=${errorCount}`);
      // Kontingentgrenze unter Gleichzeitigkeit: 9 verbrauchte (gealterte) Zeilen,
      // dann 15 gleichzeitige → nie mehr als 10 verbraucht+reserviert.
      const userB2 = randomUUID();
      createdUsers.push(userB2);
      for (let i = 0; i < 9; i += 1) {
        const rid = randomUUID();
        await reserve(service, userB2, rid, 'h');
        await service.rpc('ai_search_quota_finalize', { p_request_id: rid, p_limit: 10 });
        await ageOwnRows(userB2);
      }
      const burst = await Promise.all(Array.from({ length: 15 }, () => reserve(service, userB2, randomUUID(), 'h')));
      const { data: remainingB2 } = await service.rpc('ai_search_quota_remaining', { p_user_id: userB2, p_limit: 10 });
      check('Bremse + Limit: genau 1 reserviert, danach Rest 0, keine Fehler',
        burst.filter((r) => r.data === 'reserved').length === 1 && remainingB2 === 0 && burst.every((r) => !r.error),
        burst.map((r) => r.error?.message ?? r.data).join(','));
    }

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
      await ageOwnRows(userD);
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

    // --- 8./9. Outbox-Worker und atomare Uebernahme --------------------------
    // Benoetigen Migration 20261115200229 (ai_search_index_state +
    // ai_search_apply_*). Ist sie nicht angewendet, werden diese Abschnitte
    // ausdruecklich als NICHT GEPRUEFT ausgewiesen (kein stilles Gruen).
    {
      // Bewusst GET statt HEAD-Count: HEAD-Antworten tragen keinen Fehlerkoerper,
      // eine fehlende Tabelle bliebe dort unbemerkt (in CI beobachtet).
      const { error: stateProbeError } = await service
        .from('ai_search_index_state')
        .select('course_id')
        .limit(1);
      workerApplyAvailable = !stateProbeError;
    }
    if (!workerApplyAvailable) {
      console.log('8./9. ÜBERSPRUNGEN (NICHT GEPRÜFT): Migration 20261115200229 '
        + '(ai_search_index_state / ai_search_apply_*) ist auf dem Testprojekt noch '
        + 'nicht angewendet — die Worker-DB-Nachweise stehen damit noch aus.');
    } else {
      // --- 8. Outbox-Worker auf eigenen synthetischen Jobzeilen --------------
      console.log('8. Outbox-Worker: eigene Jobs koalesziert verarbeiten und abschliessen');
      const workerCourseIds = [fakeCourseId(), fakeCourseId()];
      createdJobCourseIds.push(...workerCourseIds);
      {
        // Zwei Jobs für denselben (nicht existenten) Kurs → Koaleszenz; einer
        // für einen zweiten. Fehlende Quellzeile bedeutet Löschanweisung
        // (Tombstone) — es werden also keinerlei Dokumente/Chunks angelegt.
        const { error: enqueueError } = await service.from('ai_search_jobs').insert([
          { course_id: workerCourseIds[0], reason: 'reconciliation', priority: 5 },
          { course_id: workerCourseIds[0], reason: 'course_upsert', priority: 3 },
          { course_id: workerCourseIds[1], reason: 'reconciliation', priority: 5 },
        ]);
        check('eigene Testjobs eingereiht', !enqueueError, enqueueError?.message ?? '');

        const summary = await processOutboxBatch(service, { onlyCourseIds: workerCourseIds });
        check('Worker verarbeitet genau die eigenen Jobs (3 Jobs, 2 Kurse, keine Fehler)',
          summary.fetchedJobs === 3 && summary.courses === 2 && summary.failures === 0,
          JSON.stringify({ fetchedJobs: summary.fetchedJobs, courses: summary.courses, failures: summary.failures, errors: summary.errors }));
        check('fehlende Quellzeilen ergeben Löschanweisungen (kein Indexeintrag)',
          summary.deleted === 2, String(summary.deleted));

        const { data: jobRows, error: jobReadError } = await service
          .from('ai_search_jobs').select('status').in('course_id', workerCourseIds);
        check('alle eigenen Jobs sind abgeschlossen (done)',
          !jobReadError && (jobRows ?? []).length === 3 && jobRows.every((row) => row.status === 'done'),
          jobReadError?.message ?? JSON.stringify(jobRows));
      }

      // --- 9. Atomare Uebernahme am eigenen echten Kurs ----------------------
      console.log('9. Atomare Übernahme: eigener Testkurs, Vollständigkeit, Nebenläufigkeit, Rücknahme, Reparatur');
      const marker = `AI-DB-TEST ${randomUUID()}`;
      const { data: ownCourse, error: courseInsertError } = await service
        .from('courses')
        .insert({
          title: marker,
          status: 'published',
          booking_type: 'lead',
          // Zwei Textfelder → mehrere Abschnitte (noetig fuer den
          // Regressionsfall "einer von mehreren Abschnitten fehlt"):
          description: 'Eigener Testkurs der KI-Such-DB-Tests. Wird im Cleanup gelöscht.',
          objectives: ['Zielbeschreibung des Testkurses mit eigenem Abschnitt.'],
          canton: 'Zürich',
        })
        .select('id')
        .single();
      check('eigener Testkurs angelegt', !courseInsertError && Boolean(ownCourse?.id),
        courseInsertError?.message ?? '');

      if (ownCourse?.id) {
        createdCourseIds.push(ownCourse.id);
        createdJobCourseIds.push(ownCourse.id);

        const docPayload = (hash, title) => ({
          title, description_clean: 'x', facts: {}, price_status: 'unknown',
          price_amount: null, content_hash: hash,
        });
        const chunksPayload = (n) => Array.from({ length: n }, (_, i) => ({
          section: 'description', chunk_index: i, char_start: 0, char_end: 1, text: `t${i}`,
        }));
        const chunkCountOf = async () => {
          const { count } = await service.from('ai_search_chunks')
            .select('*', { count: 'exact', head: true }).eq('course_id', ownCourse.id);
          return count ?? 0;
        };
        const currentVersion = async () => {
          const { data } = await service.from('ai_search_index_state')
            .select('last_source_version').eq('course_id', ownCourse.id).maybeSingle();
          return Number(data?.last_source_version ?? 0);
        };

        // 9a. Trigger → Worker → Index (Ende-zu-Ende): Das Anlegen des Kurses
        // hat per Outbox-Trigger bereits einen echten Job eingereiht.
        const run1 = await processOutboxBatch(service, { onlyCourseIds: [ownCourse.id] });
        check('Trigger-Job des Kursanlegens wird zum Indexeintrag verarbeitet',
          run1.inserted === 1 && run1.failures === 0,
          JSON.stringify({ run1: { inserted: run1.inserted, failures: run1.failures, errors: run1.errors } }));
        const { data: docRow } = await service.from('ai_search_documents')
          .select('title, content_hash, source_version')
          .eq('course_id', ownCourse.id).maybeSingle();
        check('Dokument vorhanden und trägt den Kurstitel', docRow?.title === marker, JSON.stringify(docRow));

        // 9a-v. VOLLSTAENDIGER Abschnittsvergleich (Position + Inhalt je
        // Chunk gegen die frisch gebaute Projektion) — "mindestens ein
        // Chunk" genuegt ausdruecklich nicht.
        const verifyClean = await verifyCourseChunks(service, ownCourse.id);
        check('Abschnittsvergleich: alle erwarteten Chunks exakt gespeichert (>= 2 Abschnitte)',
          verifyClean.ok && verifyClean.expectedCount >= 2,
          JSON.stringify(verifyClean));

        // 9a-r. REGRESSION: einer von mehreren Abschnitten fehlt → der
        // Vergleich benennt ihn; identischer Retry repariert den Bestand.
        {
          const { error: dropError } = await service.from('ai_search_chunks')
            .delete().eq('course_id', ownCourse.id).eq('section', 'objectives');
          const verifyBroken = await verifyCourseChunks(service, ownCourse.id);
          check('fehlender Abschnitt wird vom Vergleich erkannt und benannt',
            !dropError && !verifyBroken.ok && verifyBroken.missing.length >= 1
              && verifyBroken.missing.every((key) => key.startsWith('objectives#')),
            JSON.stringify({ dropError: dropError?.message, verifyBroken }));

          const repairVersion = await currentVersion();
          const source = await loadCourseSource(service, ownCourse.id);
          const projection = buildProjection(source.course,
            { profile: source.profile, categoryPaths: source.categoryPaths },
            { sourceVersion: repairVersion });
          const repair = await service.rpc('ai_search_apply_upsert', {
            p_course_id: ownCourse.id,
            p_source_version: repairVersion,
            p_document: projection.document,
            p_chunks: projection.chunks.map((c) => ({
              section: c.section, chunk_index: c.chunk_index,
              char_start: c.char_start, char_end: c.char_end, text: c.text,
            })),
          });
          const verifyRepaired = await verifyCourseChunks(service, ownCourse.id);
          check('identischer Retry repariert den unvollständigen Bestand vollständig',
            repair.data === 'repaired' && verifyRepaired.ok,
            JSON.stringify({ repair: repair.data ?? repair.error?.message, verifyRepaired }));
        }

        // 9b-w. ZWEI VOLLSTAENDIGE WORKERLAEUFE gleichzeitig (nicht nur
        // RPCs): beide holen dieselben offenen Jobs, koaleszieren und
        // uebernehmen — der Kurs-Lock serialisiert, nichts geht verloren.
        {
          const { error: twoJobsError } = await service.from('ai_search_jobs').insert([
            { course_id: ownCourse.id, reason: 'reconciliation', priority: 5 },
            { course_id: ownCourse.id, reason: 'course_upsert', priority: 5 },
          ]);
          const { data: jobVersions } = await service.from('ai_search_jobs')
            .select('source_version').eq('course_id', ownCourse.id).eq('status', 'pending');
          const maxJobVersion = Math.max(...(jobVersions ?? []).map((row) => Number(row.source_version)));
          const [workerA, workerB] = await Promise.all([
            processOutboxBatch(service, { onlyCourseIds: [ownCourse.id] }),
            processOutboxBatch(service, { onlyCourseIds: [ownCourse.id] }),
          ]);
          const { data: openAfter } = await service.from('ai_search_jobs')
            .select('id').eq('course_id', ownCourse.id).eq('status', 'pending');
          const verifyAfterWorkers = await verifyCourseChunks(service, ownCourse.id);
          check('zwei gleichzeitige Workerläufe: keine Fehler, alle Jobs abgeschlossen, Stand = höchste Jobversion, Bestand vollständig',
            !twoJobsError && workerA.failures === 0 && workerB.failures === 0
              && (openAfter ?? []).length === 0
              && (await currentVersion()) === maxJobVersion
              && verifyAfterWorkers.ok,
            JSON.stringify({
              twoJobsError: twoJobsError?.message,
              workerA: { courses: workerA.courses, failures: workerA.failures, errors: workerA.errors },
              workerB: { courses: workerB.courses, failures: workerB.failures, errors: workerB.errors },
              openAfter: (openAfter ?? []).length,
              maxJobVersion,
            }));
        }

        const baseVersion = await currentVersion();

        // 9b. Zwei gleichzeitige Uebernahme-RPCs mit unterschiedlicher
        // Version (echte parallele HTTP-Sitzungen; derselbe Mechanismus,
        // den die Workerlaeufe nutzen): am Ende gewinnt die hoehere.
        const vHigh = baseVersion + 10;
        const vLow = baseVersion + 5;
        const [highRes, lowRes] = await Promise.all([
          service.rpc('ai_search_apply_upsert', {
            p_course_id: ownCourse.id, p_source_version: vHigh,
            p_document: docPayload('hash-high', `${marker} H`), p_chunks: chunksPayload(2),
          }),
          service.rpc('ai_search_apply_upsert', {
            p_course_id: ownCourse.id, p_source_version: vLow,
            p_document: docPayload('hash-low', `${marker} L`), p_chunks: chunksPayload(3),
          }),
        ]);
        const { data: afterConcurrent } = await service.from('ai_search_documents')
          .select('content_hash, source_version').eq('course_id', ownCourse.id).maybeSingle();
        check('parallele Übernahmen: keine Fehler, am Ende gewinnt die höchste Version',
          !highRes.error && !lowRes.error
            && Number(afterConcurrent?.source_version) === vHigh
            && afterConcurrent?.content_hash === 'hash-high'
            && (await chunkCountOf()) === 2,
          JSON.stringify({
            high: highRes.data ?? highRes.error?.message,
            low: lowRes.data ?? lowRes.error?.message,
            afterConcurrent,
          }));

        // 9c. Rücknahme während eines älteren laufenden Auftrags: die ältere
        // Übernahme darf den zurückgezogenen Kurs nicht wieder anlegen.
        const vDelete = baseVersion + 20;
        const vLate = baseVersion + 15;
        const del = await service.rpc('ai_search_apply_delete', {
          p_course_id: ownCourse.id, p_source_version: vDelete,
        });
        const late = await service.rpc('ai_search_apply_upsert', {
          p_course_id: ownCourse.id, p_source_version: vLate,
          p_document: docPayload('hash-late', 'verspätet'), p_chunks: chunksPayload(1),
        });
        const { data: afterDelete } = await service.from('ai_search_documents')
          .select('course_id').eq('course_id', ownCourse.id).maybeSingle();
        check('Rücknahme gewinnt: Eintrag entfernt, verspäteter älterer Upsert legt NICHT wieder an',
          del.data === 'deleted' && late.data === 'stale_skipped' && afterDelete === null,
          JSON.stringify({ del: del.data ?? del.error?.message, late: late.data ?? late.error?.message, afterDelete }));

        // 9d. Fehler zwischen Schreibschritten: ein unvollständiger Bestand
        // (Dokument da, Chunks lückenhaft) wird beim erneuten Versuch mit
        // GLEICHER Version/gleichem Inhalt repariert statt übersprungen.
        const vRepair = baseVersion + 30;
        const repairArgs = {
          p_course_id: ownCourse.id, p_source_version: vRepair,
          p_document: docPayload('hash-repair', 'Reparatur'), p_chunks: chunksPayload(3),
        };
        const first = await service.rpc('ai_search_apply_upsert', repairArgs);
        const { error: breakError } = await service.from('ai_search_chunks')
          .delete().eq('course_id', ownCourse.id).eq('chunk_index', 2);
        const retry = await service.rpc('ai_search_apply_upsert', repairArgs);
        check('unvollständiger Bestand wird bei identischem Retry repariert (alle Chunks wieder da)',
          !breakError && first.data === 'inserted' && retry.data === 'repaired' && (await chunkCountOf()) === 3,
          JSON.stringify({ first: first.data ?? first.error?.message, retry: retry.data ?? retry.error?.message, breakError: breakError?.message }));
      }
    }

    // --- 10. Ergebnisspeicher + Bremse (Migration 20261121122101) -------------
    if (!guardAvailable) {
      console.log('10. ÜBERSPRUNGEN (NICHT GEPRÜFT): Migration 20261121122101 '
        + '(ai_search_results / ai_search_quota_finalize_and_store) ist nicht angewendet.');
    } else {
      console.log('10. Abschluss+Speicherung atomar, Wiederabruf, gleichzeitige Abschlüsse, Rechte');
      // Echtes eigenes Anmeldekonto (Ergebnisse verweisen auf auth.users); keine Mail.
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email: `zz-ki-dbtest-${randomUUID().slice(0, 8)}@example.com`,
        password: `Db-${randomUUID()}`,
        email_confirm: true,
      });
      check('eigenes Testkonto angelegt', !createError && Boolean(created?.user?.id), createError?.message);
      const owner = created?.user?.id;
      if (owner) {
        createdAuthUsers.push(owner);
        createdUsers.push(owner);
        const payload = { results: [{ courseId: 1 }], criteria: { terms: ['yoga'] } };
        const fas = (rid, userId = owner, hash = 'h', body = payload) => service.rpc('ai_search_quota_finalize_and_store', {
          p_request_id: rid, p_user_id: userId, p_query_hash: hash, p_payload: body, p_limit: 10,
        });
        const fetchResult = (rid, userId = owner, hash = 'h') => service.rpc('ai_search_result_fetch', {
          p_request_id: rid, p_user_id: userId, p_query_hash: hash,
        });

        // 10a. Speicherfehler: Ausnahme, nichts gezählt, nichts gespeichert.
        const failing = randomUUID();
        await reserve(service, owner, failing, 'h');
        const tooLarge = await fas(failing, owner, 'h', { x: 'a'.repeat(600_000) });
        const { data: failingRow } = await service.from('ai_search_usage').select('state').eq('request_id', failing).single();
        check('Speicherfehler: Fehler gemeldet, Reservierung unverändert offen, kein Ergebnis',
          Boolean(tooLarge.error) && failingRow?.state === 'reserved' && (await fetchResult(failing)).data === null,
          JSON.stringify({ error: tooLarge.error?.message, state: failingRow?.state }));
        await service.rpc('ai_search_quota_release', { p_request_id: failing });
        await ageOwnRows(owner);

        // 10b. Zwei GLEICHZEITIGE Abschlussversuche: genau einer zählt/speichert.
        const rid = randomUUID();
        await reserve(service, owner, rid, 'h');
        const both = await Promise.all([fas(rid), fas(rid)]);
        const outcomes = both.map((r) => r.error?.message ?? r.data).sort();
        const { count: resultRows } = await service.from('ai_search_results').select('*', { count: 'exact', head: true }).eq('request_id', rid);
        check('gleichzeitige Abschlüsse: einmal completed, einmal not_reserved, genau 1 Ergebnis',
          JSON.stringify(outcomes) === JSON.stringify(['completed', 'not_reserved']) && resultRows === 1,
          JSON.stringify({ outcomes, resultRows }));

        // 10c. Verlorene Antwort: dieselbe Kennung → already_completed + Ergebnis, keine neue Zeile.
        const { count: rowsBefore } = await service.from('ai_search_usage').select('*', { count: 'exact', head: true }).eq('user_id', owner);
        const again = await reserve(service, owner, rid, 'h');
        const restored = await fetchResult(rid);
        const { count: rowsAfter } = await service.from('ai_search_usage').select('*', { count: 'exact', head: true }).eq('user_id', owner);
        check('Wiederabruf: already_completed, gespeichertes Ergebnis, keine neue Zeile',
          again.data === 'already_completed' && JSON.stringify(restored.data) === JSON.stringify(payload) && rowsBefore === rowsAfter,
          JSON.stringify({ again: again.data, rowsBefore, rowsAfter }));

        // 10d. Fremdes Konto / anderer Inhalt: kein Ergebnis.
        check('fremdes Konto oder anderer Inhalt erhält kein Ergebnis',
          (await fetchResult(rid, randomUUID())).data === null && (await fetchResult(rid, owner, 'anders')).data === null);

        // 10e. Nach > 1 h und trotz Abkühlpause: Wiederabruf nicht gebremst.
        await ageOwnRows(owner);
        for (let i = 0; i < 5; i += 1) {
          await service.from('ai_search_usage').insert({ user_id: owner, month_key: '2000-01', request_id: randomUUID(), query_hash: `f${i}`, state: 'released', created_at: new Date(Date.now() - (i + 2) * 60_000).toISOString() });
        }
        const blocked = await reserve(service, owner, randomUUID(), 'neu');
        const retry = await reserve(service, owner, rid, 'h');
        check('nach 2 h und bei Abkühlpause: neue Suche gebremst, Wiederabruf nicht',
          blocked.data === 'cooldown' && retry.data === 'already_completed' && (await fetchResult(rid)).data !== null,
          JSON.stringify({ blocked: blocked.data, retry: retry.data }));

        // 10f. Rechte: Clients erreichen weder Speicher noch Funktionen.
        const anonFetch = await anon.rpc('ai_search_result_fetch', { p_request_id: rid, p_user_id: owner, p_query_hash: 'h' });
        const anonSelect = await anon.from('ai_search_results').select('*').limit(1);
        check('anon: kein Abruf, kein Lesezugriff', Boolean(anonFetch.error) && (Boolean(anonSelect.error) || (anonSelect.data ?? []).length === 0));
      }
    }
  } finally {
    // Eigene Anmeldekonten löschen (Ergebnisse folgen per ON DELETE CASCADE)
    // und Rückstandsfreiheit der Ergebnisse prüfen.
    for (const id of createdAuthUsers) {
      try {
        const { error } = await service.auth.admin.deleteUser(id);
        if (error) { failures += 1; console.error(`FEHLER Konto-Cleanup: ${error.message}`); }
        const { count } = await service.from('ai_search_results').select('*', { count: 'exact', head: true }).eq('user_id', id);
        if ((count ?? 0) > 0) { failures += 1; console.error(`FEHLER Ergebnis-Cleanup: ${count} Zeilen verblieben.`); }
      } catch (authCleanupException) {
        failures += 1;
        console.error('FEHLER beim Konto-Cleanup:', authCleanupException);
      }
    }
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
    // Eigene Testkurse entfernen (ON DELETE CASCADE räumt Dokumente/Chunks;
    // der Lösch-Trigger reiht noch einen Job ein, der direkt danach mit den
    // Jobzeilen entfernt wird).
    try {
      if (createdCourseIds.length > 0) {
        const { error: courseCleanupError, count: courseCount } = await service
          .from('courses')
          .delete({ count: 'exact' })
          .in('id', createdCourseIds);
        console.log(`Cleanup: ${courseCount ?? 0} Testkurs(e) gelöscht${courseCleanupError ? ` (FEHLER: ${courseCleanupError.message})` : ''}`);
        if (courseCleanupError) failures += 1;
        if (!courseCleanupError) {
          const { count: courseResidual } = await service
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .in('id', createdCourseIds);
          if ((courseResidual ?? 0) > 0) {
            failures += 1;
            console.error(`FEHLER Kurs-Cleanup unvollständig: ${courseResidual} Zeilen verblieben.`);
          }
        }
      }
    } catch (courseCleanupException) {
      failures += 1;
      console.error('FEHLER beim Kurs-Cleanup:', courseCleanupException);
    }
    // Eigene Worker-Testjobs entfernen (nur eigene synthetische Kurs-IDs).
    try {
      if (createdJobCourseIds.length > 0) {
        const { error: jobCleanupError, count: jobCount } = await service
          .from('ai_search_jobs')
          .delete({ count: 'exact' })
          .in('course_id', createdJobCourseIds);
        console.log(`Cleanup: ${jobCount ?? 0} Testjobzeilen gelöscht${jobCleanupError ? ` (FEHLER: ${jobCleanupError.message})` : ''}`);
        if (jobCleanupError) failures += 1;
        if (!jobCleanupError) {
          const { count: jobResidual } = await service
            .from('ai_search_jobs')
            .select('*', { count: 'exact', head: true })
            .in('course_id', createdJobCourseIds);
          if ((jobResidual ?? 0) > 0) {
            failures += 1;
            console.error(`FEHLER Job-Cleanup unvollständig: ${jobResidual} Zeilen verblieben.`);
          }
        }
      }
    } catch (jobCleanupException) {
      failures += 1;
      console.error('FEHLER beim Job-Cleanup:', jobCleanupException);
    }
    // Eigene Wasserstands-/Tombstonezeilen entfernen (nur eigene Kurs-IDs).
    try {
      if (workerApplyAvailable && createdJobCourseIds.length > 0) {
        const { error: stateCleanupError, count: stateCount } = await service
          .from('ai_search_index_state')
          .delete({ count: 'exact' })
          .in('course_id', createdJobCourseIds);
        console.log(`Cleanup: ${stateCount ?? 0} Wasserstandszeilen gelöscht${stateCleanupError ? ` (FEHLER: ${stateCleanupError.message})` : ''}`);
        if (stateCleanupError) failures += 1;
        if (!stateCleanupError) {
          const { count: stateResidual } = await service
            .from('ai_search_index_state')
            .select('*', { count: 'exact', head: true })
            .in('course_id', createdJobCourseIds);
          if ((stateResidual ?? 0) > 0) {
            failures += 1;
            console.error(`FEHLER State-Cleanup unvollständig: ${stateResidual} Zeilen verblieben.`);
          }
        }
      }
    } catch (stateCleanupException) {
      failures += 1;
      console.error('FEHLER beim State-Cleanup:', stateCleanupException);
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
