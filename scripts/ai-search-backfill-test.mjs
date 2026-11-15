/**
 * Begrenzter Stufe-1-Backfill der KI-Suche — AUSSCHLIESSLICH auf dem
 * freigegebenen Supabase-TESTprojekt "TESTumgebung KursNavi"
 * (omoapbvfligjfznzivyu). NICHT der generische Cron-Endpunkt:
 *
 *  - Zieladresse wird mit demselben strikten URL-Parser erzwungen wie in
 *    scripts/ai-search-db-tests.mjs (jede andere Adresse, insbesondere
 *    Produktion, wird vor Ausführung hart abgewiesen).
 *  - Zusaetzliche ausdrueckliche Bestaetigung noetig:
 *    AI_BACKFILL_CONFIRM=omoapbvfligjfznzivyu muss gesetzt sein.
 *  - GLOBALE Kontingentbereinigung ist AUSGESCHALTET (skipQuotaCleanup)
 *    und es gibt KEINEN Mailversand.
 *  - Es laufen keine Modellaufrufe: nur Projektion/Chunks/Lexikalik;
 *    embedding/model_version bleiben NULL (Backfill-Stufe 2 nach Gate E3).
 *
 * Ablauf: Reconciliation reiht fehlende veroeffentlichte Kurse ein
 * (Anti-Join = Stufe-1-Backfill), der Worker arbeitet die Outbox leer,
 * danach werden die Nachweise gemaess Pruefpunkt 5 ausgegeben:
 * Kursabdeckung, Chunk-Vollstaendigkeit, offene/fehlgeschlagene Jobs,
 * Entfernung zurueckgezogener Angebote. Exit-Code 1 bei Luecken.
 *
 * WICHTIG: Die erfolgreiche Befuellung des TESTbestands ersetzt NICHT den
 * Abgleich mit dem aktuellen oeffentlichen Katalog (E1) — der laeuft gegen
 * den echten Bestand und bleibt ein separates, freizugebendes Arbeitspaket.
 */

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { checkTestTarget, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { drainOutbox } from '../src/lib/aiSearch/worker.js';
import { runReconciliation } from '../src/lib/aiSearch/reconciliation.js';

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) {
    console.error(`Abbruch: ${guard.reason}`);
    process.exit(2);
  }
  if (process.env.AI_BACKFILL_CONFIRM !== EXPECTED_TEST_REF) {
    console.error('Abbruch: Dieser Befuellungslauf braucht die ausdrueckliche Bestaetigung');
    console.error(`  AI_BACKFILL_CONFIRM=${EXPECTED_TEST_REF}`);
    console.error('und ist ausschliesslich fuer die TESTumgebung KursNavi bestimmt.');
    process.exit(2);
  }

  const service = createClient(
    process.env.SUPABASE_URL_TEST,
    process.env.SUPABASE_SECRET_KEY_TEST,
    { auth: { persistSession: false } },
  );

  // Bereitstellungs-Check (alle vier Migrationen muessen angewendet sein).
  // GET statt HEAD-Count: fehlende Tabellen sind sonst nicht erkennbar.
  for (const table of ['ai_search_jobs', 'ai_search_documents', 'ai_search_index_state']) {
    const { error } = await service.from(table).select('course_id').limit(1);
    if (error) {
      console.error(`Abbruch: ${table} nicht verfuegbar (${error.message}) — Migrationen pruefen.`);
      process.exit(2);
    }
  }

  console.log(`Stufe-1-Backfill gegen Projekt ${EXPECTED_TEST_REF} (TESTumgebung KursNavi)`);
  console.log('Kontingent-Cleanup: AUS; Mailversand: keiner; Modellaufrufe: keine.');

  // 1. Reconciliation reiht fehlende/verwaiste Kurse ein (ohne Quota-Cleanup).
  //    Mehrere Runden, falls die Einreihungs-Kappung greift.
  let reconciliation;
  for (let round = 1; round <= 10; round += 1) {
    reconciliation = await runReconciliation(service, { skipQuotaCleanup: true });
    console.log(`Reconciliation Runde ${round}:`, JSON.stringify(reconciliation));
    const drained = await drainOutbox(service, { timeBudgetMs: 10 * 60_000 });
    console.log(`Worker Runde ${round}:`, JSON.stringify({ ...drained, errors: drained.errors.slice(0, 5) }));
    if (!reconciliation.truncated && drained.drained) break;
  }

  // 2. Nachweise (Pruefpunkt 5):
  const count = async (table, applyFilter) => {
    let query = service.from(table).select('*', { count: 'exact', head: true });
    if (applyFilter) query = applyFilter(query);
    const { count: value, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    return value ?? 0;
  };

  const publishedCount = await count('courses', (q) => q.eq('status', 'published'));
  const documentCount = await count('ai_search_documents');
  // Chunk-Vollstaendigkeit ueber Mengenvergleich der IDs (seitenweise,
  // wie die Reconciliation; PostgREST kann kein Sub-Select):
  const fetchIds = async (table, column, applyFilter) => {
    const ids = new Set();
    for (let offset = 0; ; offset += 1000) {
      let query = service.from(table).select(column).order(column).range(offset, offset + 999);
      if (applyFilter) query = applyFilter(query);
      const { data, error } = await query;
      if (error) throw new Error(`${table}: ${error.message}`);
      for (const row of data ?? []) ids.add(String(row[column]));
      if ((data ?? []).length < 1000) break;
    }
    return ids;
  };
  const docIds = await fetchIds('ai_search_documents', 'course_id');
  const chunkDocIds = await fetchIds('ai_search_chunks', 'course_id');
  const docsWithoutChunks = [...docIds].filter((id) => !chunkDocIds.has(id));
  const publishedIds = await fetchIds('courses', 'id', (q) => q.eq('status', 'published'));
  const missingDocs = [...publishedIds].filter((id) => !docIds.has(id));
  const orphanedDocs = [...docIds].filter((id) => !publishedIds.has(id));
  const pendingJobs = await count('ai_search_jobs', (q) => q.eq('status', 'pending'));
  const failedJobs = await count('ai_search_jobs', (q) => q.eq('status', 'failed'));

  console.log('\n--- Nachweise (Pruefpunkt 5) ---');
  console.log(`Veroeffentlichte Kurse:            ${publishedCount}`);
  console.log(`Indexdokumente:                    ${documentCount}`);
  console.log(`Fehlend im Index:                  ${missingDocs.length}${missingDocs.length ? ` (${missingDocs.slice(0, 10).join(', ')}…)` : ''}`);
  console.log(`Verwaist im Index (zurueckgezogen): ${orphanedDocs.length}${orphanedDocs.length ? ` (${orphanedDocs.slice(0, 10).join(', ')}…)` : ''}`);
  console.log(`Dokumente ohne Chunks:             ${docsWithoutChunks.length}${docsWithoutChunks.length ? ` (${docsWithoutChunks.slice(0, 10).join(', ')}…)` : ''}`);
  console.log(`Offene Jobs (pending):             ${pendingJobs}`);
  console.log(`Fehlgeschlagene Jobs (failed):     ${failedJobs}`);
  console.log(`Alarme der letzten Reconciliation: ${JSON.stringify(reconciliation?.alarms ?? [])}`);
  console.log('\nHinweis: Dieser Nachweis gilt fuer den TESTbestand. Der Abgleich mit dem');
  console.log('aktuellen OEFFENTLICHEN Katalog (E1) ist ein separates Arbeitspaket.');

  const gaps = missingDocs.length + orphanedDocs.length + docsWithoutChunks.length + failedJobs;
  process.exit(gaps === 0 && pendingJobs === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Unerwarteter Fehler:', error);
    process.exit(1);
  });
}
