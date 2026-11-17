/**
 * Backfill-Stufe 2 der KI-Suche (Embeddings) — AUSSCHLIESSLICH TESTumgebung.
 *
 * STANDARD = TROCKENLAUF: zählt nur die einzubettenden Abschnitte und
 * schätzt Tokens und Kosten. Es findet KEIN Modellaufruf statt.
 *
 * Echte (kostenpflichtige) Ausführung erst nach Freigabe E3 und nur mit:
 *   --execute  UND  AI_SEARCH_MODELS_ENABLED=1  UND  OPENAI_API_KEY
 *   UND  AI_EMBED_CONFIRM=omoapbvfligjfznzivyu  UND  --max-usd=<Grenze>
 * Liegt die Schätzung über --max-usd, bricht der Lauf vor dem ersten Aufruf ab.
 * --activate schaltet die Modellversion erst aktiv, wenn ALLE Abschnitte
 * dieser Version eingebettet sind (Zählabgleich, atomare Umschaltung).
 */

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { checkTestTarget, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';

const PRICE_USD_PER_MILLION = Number(process.env.AI_EMBED_PRICE_USD_PER_M ?? 0.02); // Preisliste 13.11.2026, vor Beschaffung bestätigen
const CHARS_PER_TOKEN = 4; // konservative Faustregel für Deutsch
const BATCH = 100;

export function estimateCost(totalChars, pricePerMillion = PRICE_USD_PER_MILLION) {
  const tokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  return { tokens, usd: (tokens / 1_000_000) * pricePerMillion };
}

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  return hit.includes('=') ? hit.split('=')[1] : true;
}

async function fetchPendingChunks(service, version) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await service
      .from('ai_search_chunks')
      .select('id, text, model_version')
      .order('id')
      .range(offset, offset + 999);
    if (error) throw new Error(`Abschnitte lesen: ${error.message}`);
    rows.push(...(data ?? []).filter((row) => row.model_version !== version));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }

  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });
  const config = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });
  const pending = await fetchPendingChunks(service, config.embeddingVersion);
  const totalChars = pending.reduce((sum, row) => sum + row.text.length, 0);
  const estimate = estimateCost(totalChars);

  console.log(`Modellversion: ${config.embeddingVersion}`);
  console.log(`Einzubettende Abschnitte: ${pending.length}, Zeichen: ${totalChars}`);
  console.log(`Schätzung: ~${estimate.tokens} Tokens ≈ USD ${estimate.usd.toFixed(4)} (Preis ${PRICE_USD_PER_MILLION} USD/Mio., ohne Gewähr)`);

  if (!arg('execute')) {
    console.log('TROCKENLAUF: keine Modellaufrufe. Für die echte Ausführung siehe Kopfkommentar (Freigabe E3 nötig).');
    return;
  }
  if (process.env.AI_EMBED_CONFIRM !== EXPECTED_TEST_REF) { console.error('Abbruch: AI_EMBED_CONFIRM fehlt.'); process.exit(2); }
  if (!config.enabled) { console.error(`Abbruch: ${config.reason}`); process.exit(2); }
  const maxUsd = Number(arg('max-usd'));
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) { console.error('Abbruch: --max-usd=<Grenze> ist Pflicht.'); process.exit(2); }
  if (estimate.usd > maxUsd) { console.error(`Abbruch: Schätzung USD ${estimate.usd.toFixed(4)} über Grenze ${maxUsd}.`); process.exit(2); }

  const gateway = createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: config.embeddingModel });
  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const vectors = await gateway.embed(batch.map((row) => row.text));
    for (let j = 0; j < batch.length; j += 1) {
      const { error } = await service.from('ai_search_chunks')
        .update({ embedding: JSON.stringify(vectors[j]), model_version: config.embeddingVersion })
        .eq('id', batch[j].id);
      if (error) throw new Error(`Speichern ${batch[j].id}: ${error.message}`);
      done += 1;
    }
    console.log(`Eingebettet: ${done}/${pending.length}`);
  }

  if (arg('activate')) {
    const remaining = await fetchPendingChunks(service, config.embeddingVersion);
    if (remaining.length > 0) { console.error(`Nicht aktiviert: ${remaining.length} Abschnitte ohne Embedding dieser Version.`); process.exit(1); }
    const { error } = await service.from('ai_search_config').update({ active_model_version: config.embeddingVersion, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) throw new Error(`Aktivieren: ${error.message}`);
    console.log(`Aktive Modellversion: ${config.embeddingVersion}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
}
