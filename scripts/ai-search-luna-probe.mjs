/**
 * Begrenzter Luna-Vergleichstest (Nachtrag 11/12) AUSSCHLIESSLICH gegen die
 * TESTumgebung. Führt dieselbe Suchlogik wie die Preview-API (runAiSearch)
 * mit echten Modellaufrufen für feste Testfälle und wenige Einstellungen aus.
 * Feste Obergrenze: CONFIGS × CASES + REPEATS Suchen; keine Wiederholung bei
 * Fehlern. Kein Kontingentverbrauch (direkter Aufruf ohne API), keine
 * Schreibzugriffe. Zeiten sind Runner→Supabase/OpenAI, NICHT Browser-Ende-zu-Ende.
 */

import { createClient } from '@supabase/supabase-js';
import { checkTestTarget } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { countWords } from '../src/lib/aiSearch/explanation.js';

// Feste Testfälle (keine Nutzereingaben): normale Suche, Orts-Muss mit
// unbestätigten Daten, Zielgruppenfall, Nulltreffer.
const CASES = [
  { id: 'normal', query: 'Ich möchte als Anfänger fotografieren lernen, gerne im Selbststudium' },
  { id: 'ort-muss', query: 'Entspannung und Stressabbau nach der Arbeit', musts: { canton: 'Zürich', onlineAllowed: true } },
  { id: 'zielgruppe', query: 'Programmieren lernen für Einsteiger' },
  { id: 'nulltreffer', query: 'Unterwasserschweissen für Tiefseetaucher mit Kranschein' },
];
// Lauf 1 (18.11.2026): A low/1×30, B low/3×10, C none/3×10 verglichen.
// Lauf 2: Zusatzvergleich mit kleineren parallelen Teilaufrufen.
const CONFIGS = [
  { id: 'D none/5×6', effort: 'none', batchSize: 6 },
];
// Wiederholte (gleiche) Suche je Einstellung B/C — es gibt keinen Ergebniscache.
const REPEATS = [{ config: 'D none/5×6', caseId: 'ort-muss' }];

async function runOne(service, config, testCase, label) {
  const modelConfig = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });
  const gateway = createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: modelConfig.embeddingModel, reasoningEffort: config.effort, batchSize: config.batchSize });
  const started = Date.now();
  console.log(`\n=== [${config.id}] ${testCase.id}${label ? ` (${label})` : ''}`);
  try {
    const result = await runAiSearch(service, { query: testCase.query, musts: testCase.musts, models: { gateway, embeddingVersion: modelConfig.embeddingVersion } });
    const s = result.stats;
    console.log(`Gesamt ${Date.now() - started} ms | Phasen ${JSON.stringify(result.timings)} | Luna-Teilaufrufe ms ${JSON.stringify(gateway.usage.lunaCallMs)}`);
    console.log(`luna=${result.method.luna} semantic=${result.method.semantic} | gefunden ${s.candidates}, Muss-ausgeschl. ${s.excludedByMust}, an Luna ${s.sentToLuna}, bewertet ${s.rated} (unter Mindestpassung ${s.belowThreshold}), unbewertet ${s.notRated}, ungültig ${s.lunaDiscarded}, Texte verworfen ${s.explanationsRejected} | Treffer ${result.results.length}, unvollständig ${result.incompleteResults.length}`);
    for (const card of [...result.results.slice(0, 4), ...result.incompleteResults.slice(0, 2).map((c) => ({ ...c, incomplete: true }))]) {
      console.log(`- ${card.incomplete ? '(unvollst.) ' : ''}[${card.score}] ${card.title} — ${countWords(card.explanation)} Wörter: ${card.explanation}`);
    }
  } catch (error) {
    console.log(`FEHLER nach ${Date.now() - started} ms: ${error?.message ?? error}`);
  }
  const u = gateway.usage;
  console.log(`Tokens: Luna ${u.lunaInputTokens} ein / ${u.lunaOutputTokens} aus (davon Reasoning ${u.lunaReasoningTokens}), Aufrufe ${u.lunaCalls}, fehlgeschlagen ${u.lunaFailedCalls}; Embedding ${u.embeddingTokens}`);
  return u;
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }
  const config = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });
  if (!config.enabled) { console.error(`Abbruch: ${config.reason}`); process.exit(2); }
  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });

  const totals = {};
  const add = (id, u) => {
    totals[id] ??= { lunaInputTokens: 0, lunaOutputTokens: 0, lunaReasoningTokens: 0, lunaCalls: 0, lunaFailedCalls: 0, embeddingTokens: 0 };
    for (const key of Object.keys(totals[id])) totals[id][key] += u[key] ?? 0;
  };
  for (const cfg of CONFIGS) {
    for (const testCase of CASES) add(cfg.id, await runOne(service, cfg, testCase));
  }
  for (const repeat of REPEATS) {
    const cfg = CONFIGS.find((c) => c.id === repeat.config);
    add(cfg.id, await runOne(service, cfg, CASES.find((c) => c.id === repeat.caseId), 'Wiederholung'));
  }
  console.log(`\nVerbrauch je Einstellung: ${JSON.stringify(totals)}`);
}

main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
