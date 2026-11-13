/**
 * Echte Datenbanktests für die KI-Such-Grundlage (Quota, Rollen, Abruf).
 *
 * AUSFÜHRUNG ERST NACH FREIGABE E5 — ausschliesslich gegen das Supabase-
 * TESTprojekt. Benötigt (wie scripts/seed-e2e.mjs):
 *   SUPABASE_URL_TEST, SUPABASE_SECRET_KEY_TEST, SUPABASE_PUBLISHABLE_KEY_TEST
 * sowie zuvor angewendete Migrationen 20261113180000/180100/180200.
 *
 * Abgedeckt (Nachtrag 07 §4 und Prüfbefunde 1/3/4):
 *   1. Rollen/RLS: anon darf weder ai_search_*-Tabellen lesen noch
 *      Quota-Funktionen ausführen.
 *   2. Limit: 10 Reservierungen erlaubt, die elfte blockiert.
 *   3. Parallelität: 15 gleichzeitige Reservierungen → exakt 10 erfolgreich.
 *   4. Idempotenz: gleichzeitige identische request_id → genau 1x reserved,
 *      Rest already_reserved; fremder Nutzer/anderer Inhalt → request_mismatch.
 *   5. Ablauf/später Abschluss: abgelaufene Reservierung + volles Limit →
 *      finalize = released_expired, Zählung bleibt exakt 10.
 *   6. Monatsgrenze: ai_search_month_key an UTC-Randzeitpunkten (inkl. DST).
 *   7. Cleanup: verwaiste Reservierungen werden freigegeben.
 *
 * Alle Testdaten verwenden eigene Zufalls-UUIDs und werden am Ende gelöscht
 * (dokumentiertes Cleanup). Das Skript verweigert den Start gegen das
 * Produktionsprojekt.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const PRODUCTION_REF = 'nplxmpfasgpumpiddjfl';

const REQUIRED_ENV = ['SUPABASE_URL_TEST', 'SUPABASE_SECRET_KEY_TEST', 'SUPABASE_PUBLISHABLE_KEY_TEST'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Abbruch: fehlende Testprojekt-Umgebungsvariablen: ${missing.join(', ')}`);
  console.error('Dieses Skript läuft erst nach Freigabe E5 gegen das Supabase-TESTprojekt.');
  process.exit(2);
}

const url = process.env.SUPABASE_URL_TEST;
if (url.includes(PRODUCTION_REF)) {
  console.error('Abbruch: SUPABASE_URL_TEST zeigt auf das PRODUKTIONSprojekt. Niemals dort testen.');
  process.exit(2);
}

const service = createClient(url, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });
const anon = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY_TEST, { auth: { persistSession: false } });

let failures = 0;
const createdUsers = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.error(`  FEHLER ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function reserve(client, userId, requestId, queryHash, limit = 10) {
  return client.rpc('ai_search_quota_reserve', {
    p_user_id: userId, p_request_id: requestId, p_query_hash: queryHash, p_limit: limit,
  });
}

async function main() {
  console.log(`KI-Such-DB-Tests gegen ${url.replace(/^https?:\/\//, '').split('.')[0]} (Testprojekt)`);

  // --- 1. Rollen/RLS ---------------------------------------------------------
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

  // --- 2. Limit: 10 erlaubt, 11. blockiert ----------------------------------
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

  // --- 3. Parallelität -------------------------------------------------------
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

  // --- 4. Idempotenz und Bindung --------------------------------------------
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
    const { data } = await reserve(service, randomUUID(), sharedRequest, 'hash-x');
    check('fremder Nutzer mit derselben ID → request_mismatch', data === 'request_mismatch', String(data));
  }

  // --- 5. Ablauf und später Abschluss ----------------------------------------
  console.log('5. Ablauf, Ersatzvergabe, später Abschluss (Prüfbefund 1)');
  const userD = randomUUID();
  createdUsers.push(userD);
  const oldRequest = randomUUID();
  await reserve(service, userD, oldRequest, 'h');
  // Reservierung künstlich ablaufen lassen:
  await service.from('ai_search_usage')
    .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
    .eq('request_id', oldRequest);
  // Volles Limit anderweitig verbrauchen (Ersatzplatz inklusive):
  for (let i = 1; i <= 10; i += 1) {
    const requestId = randomUUID();
    await reserve(service, userD, requestId, 'h');
    await service.rpc('ai_search_quota_finalize', { p_request_id: requestId, p_limit: 10 });
  }
  {
    const { data } = await service.rpc('ai_search_quota_finalize', { p_request_id: oldRequest, p_limit: 10 });
    check('später Abschluss der abgelaufenen Reservierung → released_expired', data === 'released_expired', String(data));
  }
  {
    const { count } = await service.from('ai_search_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userD).eq('state', 'completed');
    check('exakt 10 completed, nie 11', count === 10, String(count));
  }

  // --- 6. Monatsgrenze (Europe/Zurich, inkl. DST) ----------------------------
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

  // --- 7. Cleanup verwaister Reservierungen ----------------------------------
  console.log('7. Cleanup');
  const userE = randomUUID();
  createdUsers.push(userE);
  const orphan = randomUUID();
  await reserve(service, userE, orphan, 'h');
  await service.from('ai_search_usage')
    .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
    .eq('request_id', orphan);
  {
    const { data } = await service.rpc('ai_search_quota_cleanup');
    check('Cleanup gibt mindestens 1 verwaiste Reservierung frei', (data ?? 0) >= 1, String(data));
  }
  {
    const { data } = await service.rpc('ai_search_quota_remaining', { p_user_id: userE, p_limit: 10 });
    check('Kontingent nach Cleanup wieder frei', data === 10, String(data));
  }

  // --- Testdaten-Cleanup ------------------------------------------------------
  const { error: cleanupError, count } = await service
    .from('ai_search_usage')
    .delete({ count: 'exact' })
    .in('user_id', createdUsers);
  console.log(`Cleanup: ${count ?? '?'} Testzeilen für ${createdUsers.length} Testnutzer gelöscht${cleanupError ? ` (FEHLER: ${cleanupError.message})` : ''}`);
  if (cleanupError) failures += 1;

  console.log(failures === 0 ? '\nAlle DB-Tests bestanden.' : `\n${failures} DB-Test(s) FEHLGESCHLAGEN.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Unerwarteter Fehler:', error);
  process.exit(1);
});
