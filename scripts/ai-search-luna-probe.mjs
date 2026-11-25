/**
 * Begrenzter Luna-Vergleichstest (Nachtrag 11/12) AUSSCHLIESSLICH gegen die
 * TESTumgebung. Führt dieselbe Suchlogik wie die Preview-API (runAiSearch)
 * mit echten Modellaufrufen für feste Testfälle aus. Einstellungen werden
 * abwechselnd ausgeführt (gleiche Bedingungen), jeder Fall mehrfach
 * (Wiederholbarkeit). Feste Obergrenze: ROUNDS × CASES × CONFIGS + EXTRA.
 * Keine Wiederholung bei Fehlern, kein Kontingentverbrauch, keine Schreib-
 * zugriffe. Zeiten sind Runner→Supabase/OpenAI, NICHT Browser-Ende-zu-Ende.
 */

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { checkTestTarget } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { countWords } from '../src/lib/aiSearch/explanation.js';

// Nachtrag 14 (20.11.2026): gezielter Vergleich A (einstufig) vs. B
// (zweistufig: vollständige Kurzbewertung, Begründung nur für die finale
// Auswahl). Drei feste Fälle, je Variante EIN Durchlauf, abwechselnd.
const CASES = [
  { id: 'fotografie', query: 'Ich möchte als Anfänger fotografieren lernen' },
  { id: 'fotografie-ort-muss', query: 'Ich möchte als Anfänger fotografieren lernen', musts: { canton: 'Zürich', onlineAllowed: false } },
  { id: 'programmierung', query: 'Programmieren lernen für Einsteiger' },
];
// Vergleich vom 20.11.2026 (A einstufig vs. B zweistufig): kein Wechsel,
// siehe docs/ai-search/vergleich-a-b-20261120.md.
// Nachtrag 14b (20.11.2026): einstufig 3 × 10 gegen einstufig 6 × 5. Gleiche
// Denkstufe, Kandidaten (30), Verteilung und Anweisungen; nur die Teilgrösse
// unterscheidet sich. Zwei Runden, abwechselnd → 3 Fälle × 2 × 2 = 12 Suchen.
const CONFIGS = [
  { id: 'A 3×10', effort: 'none', batchSize: 10, distribution: 'stripe', mode: 'single' },
  { id: 'A 6×5', effort: 'none', batchSize: 5, distribution: 'stripe', mode: 'single' },
];
const ROUNDS = 2;
const EXTRA = [];
const summary = {};
// Gesendete Kandidaten je Fall und Variante (Nachweis „dieselben Kandidaten“).
const sentByCase = {};

async function runOne(service, config, testCase, round) {
  const modelConfig = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });
  const gateway = createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, region: modelConfig.openaiRegion, embeddingModel: modelConfig.embeddingModel, reasoningEffort: config.effort, batchSize: config.batchSize, distribution: config.distribution, mode: config.mode });
  // Gesendete Kandidaten und gültig zurückgegebene Bewertungen mitschreiben
  // (nur IDs), ohne die Produktlogik zu ändern. Gesendet = was der Gateway
  // tatsächlich an Luna gibt (sentIds), nicht was abgerufen wurde.
  const record = { sent: null, valid: null, scores: null };
  for (const method of ['rerank', 'scoreCandidates']) {
    const original = gateway[method];
    gateway[method] = async (query, candidates) => {
      const response = await original(query, candidates);
      record.sent = (response.sentIds ?? candidates.map((c) => c.courseId)).map(String);
      record.valid = (response.accepted ?? []).filter((a) => Number.isFinite(Number(a.score))).map((a) => String(a.courseId));
      // Sämtliche Bewertungen (ID:Score), absteigend.
      record.scores = (response.accepted ?? []).map((a) => [String(a.courseId), Number(a.score)]).sort((x, y) => y[1] - x[1]);
      (sentByCase[testCase.id] ??= {})[`${config.id}#${round}`] = record.sent;
      return response;
    };
  }
  const started = Date.now();
  const key = `${config.id} | ${testCase.id}`;
  summary[key] ??= { totals: [], luna: [], hits: [], errors: 0, tokensIn: 0, tokensOut: 0, quality: [] };
  console.log(`\n=== [${config.id}] ${testCase.id} (Lauf ${round})`);
  try {
    const result = await runAiSearch(service, { query: testCase.query, musts: testCase.musts, models: { gateway, embeddingVersion: modelConfig.embeddingVersion } });
    const s = result.stats;
    const total = Date.now() - started;
    summary[key].totals.push(total);
    summary[key].luna.push(result.timings.luna ?? null);
    const shown = [...result.results, ...result.incompleteResults];
    summary[key].hits.push(shown.map((c) => c.courseId));
    // Qualität: vollständige Bewertung, Belege, Textlänge (inkl. Serverhinweise).
    const words = shown.map((c) => countWords(c.explanation));
    const withLunaQuote = shown.filter((c) => (c.reasons ?? []).some((r) => r.kind === 'luna')).length;
    const completeness = ratingCompleteness(record.sent, record.valid, s);
    const quality = {
      ...completeness,
      karten: shown.length,
      mitLunaBeleg: withLunaQuote,
      texteVerworfen: s.explanationsRejected,
      woerterMin: words.length ? Math.min(...words) : null,
      woerterMax: words.length ? Math.max(...words) : null,
      woerterSchnitt: words.length ? Math.round(words.reduce((a, b) => a + b, 0) / words.length) : null,
      begruendungenAngefordert: s.explanationsRequested,
    };
    summary[key].quality.push(quality);
    console.log(`Gesamt ${total} ms | Phasen ${JSON.stringify(result.timings)}`);
    for (const call of gateway.usage.lunaCallDetails) console.log(`  Teilaufruf ${call.stage}: ${call.candidates} Kand., ${call.ms} ms, ${call.in ?? '?'} ein / ${call.out ?? '?'} aus${call.failed ? ' FEHLGESCHLAGEN' : ''}`);
    console.log(`an Luna ${s.sentToLuna}, bewertet ${s.rated} (unter Mindestpassung ${s.belowThreshold}), unbewertet ${s.notRated}, ungültig ${s.lunaDiscarded}, Texte verworfen ${s.explanationsRejected} | Treffer ${result.results.length}, unvollständig ${result.incompleteResults.length}`);
    console.log(`Qualität ${JSON.stringify(quality)}`);
    const rankCalls = gateway.usage.lunaCallDetails.filter((c) => !c.failed);
    const slowest = rankCalls.reduce((max, c) => (c.ms > (max?.ms ?? -1) ? c : max), null);
    console.log(`Langsamster Teilaufruf ${slowest?.ms ?? '-'} ms mit ${slowest?.out ?? '-'} Ausgabetokens | max. Ausgabetokens je Teilaufruf ${Math.max(0, ...rankCalls.map((c) => c.out ?? 0))}`);
    console.log(`Alle Bewertungen (ID:Score) ${(record.scores ?? []).map(([id, sc]) => `${id}:${sc}`).join(' ')}`);
    summary[key].slowestOut = [...(summary[key].slowestOut ?? []), slowest?.out ?? null];
    summary[key].runs = [...(summary[key].runs ?? []), { round, hits: shown.map((c) => String(c.courseId)) }];
    // Öffentliches Repository: nur IDs, Scores und Wortzahlen ins Log — keine
    // Titel und keine Begründungstexte (TEST kann aktuelle Katalogdaten enthalten).
    for (const card of shown.slice(0, 10)) {
      console.log(`- ${result.incompleteResults.includes(card) ? '(unvollst.) ' : ''}[${card.score}] #${card.courseId} — ${countWords(card.explanation)} W.`);
    }
  } catch (error) {
    summary[key].errors += 1;
    console.log(`FEHLER nach ${Date.now() - started} ms: ${error?.message ?? error}`);
  }
  summary[key].tokensIn += gateway.usage.lunaInputTokens;
  summary[key].tokensOut += gateway.usage.lunaOutputTokens;
}

/**
 * Vollständigkeit der Bewertung (Nachtrag 14, Korrektur 20.11.2026):
 * „alle gesendeten Kandidaten bewertet“ vergleicht die tatsächlich an Luna
 * gesendeten IDs mit den gültig zurückgegebenen Bewertungen. Abgerufene, aber
 * nicht gesendete Kandidaten (Kappung auf 30) werden getrennt ausgewiesen;
 * stats.notRated enthält beide Gruppen und muss daher nicht 0 sein.
 */
export function ratingCompleteness(sentIds, validIds, stats) {
  const sent = new Set((sentIds ?? []).map(String));
  const valid = new Set((validIds ?? []).map(String));
  const sentNotRated = [...sent].filter((id) => !valid.has(id)).length;
  const foreign = [...valid].filter((id) => !sent.has(id)).length;
  const afterMusts = (stats?.rated ?? 0) + (stats?.notRated ?? 0); // nach Muss-Ausschluss
  return {
    alleGesendetenBewertet: sent.size > 0 && sentNotRated === 0 && foreign === 0,
    abgerufen: stats?.candidates ?? null,
    nachMussAusschluss: afterMusts,
    gesendet: sent.size,
    gueltigBewertet: [...sent].filter((id) => valid.has(id)).length,
    gesendetOhneBewertung: sentNotRated,
    nichtGesendet: Math.max(0, afterMusts - sent.size),
  };
}

function overlap(lists) {
  if (lists.length < 2) return '-';
  const sets = lists.map((l) => new Set(l));
  const union = new Set(lists.flat());
  const inAll = [...union].filter((id) => sets.every((s) => s.has(id)));
  return `${inAll.length}/${union.size} in allen Läufen gleich`;
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }
  const config = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });
  if (!config.enabled) { console.error(`Abbruch: ${config.reason}`); process.exit(2); }
  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });

  for (let round = 1; round <= ROUNDS; round += 1) {
    // Abwechselnd: in geraden Runden umgekehrte Reihenfolge (Reihenfolgeeffekt ausgleichen).
    const order = round % 2 === 1 ? CONFIGS : [...CONFIGS].reverse();
    for (const testCase of CASES) {
      for (const cfg of order) await runOne(service, cfg, testCase, round);
    }
  }
  for (const extra of EXTRA) {
    for (const cfg of CONFIGS) await runOne(service, cfg, CASES.find((c) => c.id === extra.caseId), ROUNDS + 1);
  }

  console.log('\n##### Zusammenfassung');
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: Gesamt ms ${JSON.stringify(value.totals)} | Luna ms ${JSON.stringify(value.luna)} | langsamster Teilaufruf Ausgabetokens ${JSON.stringify(value.slowestOut ?? [])} | Trefferzahl ${JSON.stringify(value.hits.map((h) => h.length))} | ${overlap(value.hits)} | Fehler ${value.errors} | Tokens ${value.tokensIn} ein / ${value.tokensOut} aus | Qualität ${JSON.stringify(value.quality)}`);
  }
  console.log('\n##### Vergleich je Fall (Trefferlisten vollständig, auch bei < 10 Treffern)');
  for (const testCase of CASES) {
    const sent = sentByCase[testCase.id] ?? {};
    console.log(`${testCase.id}:`);
    for (let round = 1; round <= ROUNDS; round += 1) {
      const [a, b] = CONFIGS.map((c) => sent[`${c.id}#${round}`]);
      const same = a && b && a.length === b.length && a.every((id) => b.includes(id));
      console.log(`  Runde ${round}: gesendete Kandidaten identisch ${same ? 'JA' : 'NEIN'} (${a?.length ?? '-'} / ${b?.length ?? '-'})`);
      const lists = CONFIGS.map((c) => (summary[`${c.id} | ${testCase.id}`]?.runs ?? []).find((r) => r.round === round)?.hits ?? null);
      CONFIGS.forEach((c, i) => console.log(`  Runde ${round} ${c.id}: ${lists[i] ? `${lists[i].length} Treffer [${lists[i].join(', ')}]` : 'FEHLER'}`));
      if (lists.every(Boolean)) {
        const [x, y] = lists;
        const onlyX = x.filter((id) => !y.includes(id));
        const onlyY = y.filter((id) => !x.includes(id));
        console.log(`  Runde ${round}: gemeinsam ${x.filter((id) => y.includes(id)).length} | nur ${CONFIGS[0].id}: [${onlyX.join(', ')}] | nur ${CONFIGS[1].id}: [${onlyY.join(', ')}]`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
}
