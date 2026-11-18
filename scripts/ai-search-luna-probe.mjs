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
import { checkTestTarget } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { countWords } from '../src/lib/aiSearch/explanation.js';

const CASES = [
  { id: 'normal', query: 'Ich möchte als Anfänger fotografieren lernen, gerne im Selbststudium' },
  { id: 'ort-muss', query: 'Entspannung und Stressabbau nach der Arbeit', musts: { canton: 'Zürich', onlineAllowed: true } },
  { id: 'zielgruppe', query: 'Programmieren lernen für Einsteiger' },
  { id: 'nulltreffer', query: 'Unterwasserschweissen für Tiefseetaucher mit Kranschein' },
];
// Lauf 3 (18.11.2026): S1 Block / S2 Reihum / S3 Zweistufig verglichen →
// S2 gewählt (schneller im Orts-Muss-Fall, 0 Fehler; S3 2 Fehler in 9 Läufen).
// Lauf 4: Bestätigung S2 nach Korrektur der Mehrteil-Antworten.
const CONFIGS = [
  { id: 'S2 Reihum 3×10', effort: 'none', batchSize: 10, distribution: 'stripe', mode: 'single' },
];
const ROUNDS = 2;
const EXTRA = [];
const summary = {};

async function runOne(service, config, testCase, round) {
  const modelConfig = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });
  const gateway = createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: modelConfig.embeddingModel, reasoningEffort: config.effort, batchSize: config.batchSize, distribution: config.distribution, mode: config.mode });
  const started = Date.now();
  const key = `${config.id} | ${testCase.id}`;
  summary[key] ??= { totals: [], luna: [], hits: [], errors: 0, tokensIn: 0, tokensOut: 0 };
  console.log(`\n=== [${config.id}] ${testCase.id} (Lauf ${round})`);
  try {
    const result = await runAiSearch(service, { query: testCase.query, musts: testCase.musts, models: { gateway, embeddingVersion: modelConfig.embeddingVersion } });
    const s = result.stats;
    const total = Date.now() - started;
    summary[key].totals.push(total);
    summary[key].luna.push(result.timings.luna ?? null);
    const shown = [...result.results, ...result.incompleteResults];
    summary[key].hits.push(shown.map((c) => c.courseId));
    console.log(`Gesamt ${total} ms | Phasen ${JSON.stringify(result.timings)}`);
    for (const call of gateway.usage.lunaCallDetails) console.log(`  Teilaufruf ${call.stage}: ${call.candidates} Kand., ${call.ms} ms, ${call.in ?? '?'} ein / ${call.out ?? '?'} aus${call.failed ? ' FEHLGESCHLAGEN' : ''}`);
    console.log(`an Luna ${s.sentToLuna}, bewertet ${s.rated} (unter Mindestpassung ${s.belowThreshold}), unbewertet ${s.notRated}, ungültig ${s.lunaDiscarded}, Texte verworfen ${s.explanationsRejected} | Treffer ${result.results.length}, unvollständig ${result.incompleteResults.length}`);
    for (const card of shown.slice(0, 10)) {
      console.log(`- ${result.incompleteResults.includes(card) ? '(unvollst.) ' : ''}[${card.score}] #${card.courseId} ${card.title} — ${countWords(card.explanation)} W.`);
    }
    if (shown[0]) console.log(`  Beispieltext: ${shown[0].explanation}`);
  } catch (error) {
    summary[key].errors += 1;
    console.log(`FEHLER nach ${Date.now() - started} ms: ${error?.message ?? error}`);
  }
  summary[key].tokensIn += gateway.usage.lunaInputTokens;
  summary[key].tokensOut += gateway.usage.lunaOutputTokens;
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
    for (const testCase of CASES) {
      for (const cfg of CONFIGS) await runOne(service, cfg, testCase, round);
    }
  }
  for (const extra of EXTRA) {
    for (const cfg of CONFIGS) await runOne(service, cfg, CASES.find((c) => c.id === extra.caseId), ROUNDS + 1);
  }

  console.log('\n##### Zusammenfassung');
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: Gesamt ms ${JSON.stringify(value.totals)} | Luna ms ${JSON.stringify(value.luna)} | Trefferzahl ${JSON.stringify(value.hits.map((h) => h.length))} | ${overlap(value.hits)} | Fehler ${value.errors} | Tokens ${value.tokensIn} ein / ${value.tokensOut} aus`);
  }
}

main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
