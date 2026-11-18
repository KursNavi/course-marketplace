/**
 * Begrenzte Luna-Probe (Nachtrag 11) AUSSCHLIESSLICH gegen die TESTumgebung.
 * Führt dieselbe Suchlogik wie die Preview-API (runAiSearch) mit echten
 * Modellaufrufen für eine kleine, feste Liste von Testanfragen aus.
 * Höchstens PROBES.length Luna-Aufrufe je Lauf; keine Wiederholung bei Fehler.
 * Ausgabe: Methode, Treffer (Titel, Begründung), Tokenverbrauch.
 * Kein Kontingentverbrauch (direkter Aufruf ohne API), keine Schreibzugriffe.
 */

import { createClient } from '@supabase/supabase-js';
import { checkTestTarget } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { countWords } from '../src/lib/aiSearch/explanation.js';

// Feste Testanfragen (keine Nutzereingaben).
const PROBES = [
  { query: 'Ich möchte als Anfänger fotografieren lernen, gerne im Selbststudium' },
  { query: 'Entspannung und Stressabbau nach der Arbeit', musts: { canton: 'Zürich', onlineAllowed: true } },
  { query: 'Programmieren lernen für Einsteiger' },
];

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }
  const env = { ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST };
  const config = readModelConfig(env);
  if (!config.enabled) { console.error(`Abbruch: ${config.reason}`); process.exit(2); }
  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });

  const total = { lunaInputTokens: 0, lunaOutputTokens: 0, lunaReasoningTokens: 0, embeddingTokens: 0 };
  for (const [index, probe] of PROBES.entries()) {
    const gateway = createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: config.embeddingModel });
    const started = Date.now();
    console.log(`\n=== Probe ${index + 1}: „${probe.query}“${probe.musts ? ` (Muss: ${JSON.stringify(probe.musts)})` : ''}`);
    try {
      const result = await runAiSearch(service, { query: probe.query, musts: probe.musts, models: { gateway, embeddingVersion: config.embeddingVersion } });
      console.log(`Methode: ${result.method.ranking} | ${result.method.retrieval} | luna=${result.method.luna} semantic=${result.method.semantic} | ${Date.now() - started} ms`);
      console.log(`Kandidaten ${result.stats.candidates}, unter Mindestpassung ${result.stats.belowThreshold}, Muss-ausgeschlossen ${result.stats.excludedByMust}; Treffer ${result.results.length}, unvollständig ${result.incompleteResults.length}`);
      for (const card of result.results.slice(0, 5)) {
        console.log(`- [${card.score}] ${card.title} (${countWords(card.explanation)} Wörter)\n    ${card.explanation}`);
      }
      for (const card of result.incompleteResults.slice(0, 2)) {
        console.log(`- (unvollständig) [${card.score}] ${card.title}\n    ${card.explanation}`);
      }
    } catch (error) {
      console.log(`FEHLER: ${error?.message ?? error}`);
    }
    console.log(`Verbrauch: ${JSON.stringify(gateway.usage)}`);
    for (const key of Object.keys(total)) total[key] += gateway.usage[key] ?? 0;
  }
  console.log(`\nGesamtverbrauch: ${JSON.stringify(total)}`);
}

main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
