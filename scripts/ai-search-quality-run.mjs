/**
 * Qualitätsabnahme der KI-Suche: die 36 festgelegten Fälle, je EIN Lauf,
 * AUSSCHLIESSLICH gegen die TESTumgebung (Abnahmebestand Paket 2).
 *
 * STANDARD = TROCKENLAUF: lädt und prüft die Fälle, zeigt die Formular-
 * Muss-Angaben und die Kostenschätzung, prüft die Vorbedingungen im TEST
 * (nur Lesen). Kein Modellaufruf.
 *
 * Echte Ausführung nur mit:
 *   --execute  UND  --max-usd=<Grenze ≤ 1>  UND  AI_QUALITY_CONFIRM=omoapbvfligjfznzivyu
 *   UND  AI_SEARCH_MODELS_ENABLED=1  UND  OPENAI_API_KEY
 *
 * Dieselbe Suchlogik und dieselbe Modellkonfiguration wie die Such-API
 * (runAiSearch, readModelConfig, sanitizeMusts), aber ohne Nutzerkontingent
 * und ohne Ergebnisspeicher. Keine Wiederholung bei Fehlern.
 *
 * Abbruch: Vorbedingung verletzt (fremde Kurse im Index, Index unvollständig
 * oder nicht vollständig eingebettet) → kein Aufruf; geschätzte Kosten würden
 * mit der nächsten Suche die Grenze überschreiten → Stopp; ab 3 Fehlern → Stopp.
 *
 * Datenschutz: Das Repository ist öffentlich. Im Log stehen nur Fall-IDs,
 * Kurs-IDs, Scores, Zählungen und Tokens. Titel, Begründungen und die
 * Bewertungsvorlage gehen in den privaten Storage-Bucket des TEST-Projekts.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { publicEncrypt, privateDecrypt, randomBytes, createCipheriv, createDecipheriv, constants } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { checkTestTarget, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { countWords, MAX_EXPLANATION_WORDS } from '../src/lib/aiSearch/explanation.js';
import { OPS_PRICES } from '../src/lib/aiSearch/ops.js';
import { sanitizeMusts } from '../api/ai-search.js';
import { ACCEPTANCE_RANGE, ID_OFFSET, BACKUP_BUCKET, QUALITY_PREFIX } from '../src/lib/aiSearch/acceptanceCatalog.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CASES_PATH = resolve(ROOT, 'tests/fixtures/ai-search-quality/cases-36.json');
export const STARTSET_PATH = resolve(ROOT, 'tests/fixtures/ai-search-goldstandard/tasks-initial.json');
export const SOLL_PATH = resolve(ROOT, 'tests/fixtures/ai-search-quality/soll-listen.json');
export const MAX_USD_CEILING = 1;
export const MAX_ERRORS = 3;
/** Annahme je Suche (e3-entscheidungsvorlage): 18 000 Eingabe-, 2 000 Ausgabetokens ≈ USD 0.003. */
export const SEARCH_ASSUMPTION = Object.freeze({ usd: OPS_PRICES.searchUsdMax, inputTokens: 18_000, outputTokens: 2_000 });

/** Kantonskürzel der Startaufgaben → Kantonsname wie im Formular der Oberfläche. */
export const CANTON_BY_CODE = Object.freeze({
  AG: 'Aargau', BE: 'Bern', BS: 'Basel-Stadt', FR: 'Fribourg', GE: 'Genève', LU: 'Luzern',
  SG: 'St. Gallen', TI: 'Ticino', VD: 'Vaud', ZH: 'Zürich',
});

/** Formular-Muss aus den erwarteten Muss-Kriterien einer Startaufgabe. */
export function formFromExpected(expectedMusts = {}) {
  const form = {};
  if (expectedMusts.location) {
    const canton = CANTON_BY_CODE[expectedMusts.location];
    if (!canton) throw new Error(`unbekanntes Kantonskürzel ${expectedMusts.location}`);
    form.canton = canton;
    form.onlineAllowed = expectedMusts.onlineAllowed === true;
  }
  if (Number.isFinite(expectedMusts.maxBudget) && expectedMusts.maxBudget > 0) form.maxBudget = expectedMusts.maxBudget;
  return form;
}

/** Löst die Fälle auf (Startaufgaben per ref) und prüft Umfang und Gruppen. */
export function loadQualityCases(casesFile, startset) {
  const tasks = new Map((startset?.tasks ?? []).map((t) => [t.id, t]));
  const errors = [];
  const cases = (casesFile?.cases ?? []).map((entry) => {
    if (entry.ref) {
      const task = tasks.get(entry.ref);
      if (!task) { errors.push(`${entry.id}: Startaufgabe ${entry.ref} fehlt`); return null; }
      return {
        id: entry.id, group: entry.group, language: task.language, query: task.query,
        form: formFromExpected(task.expected?.musts), expectEmpty: false,
        focus: (task.traps ?? []).join(', ') || null, source: 'startset',
      };
    }
    if (!entry.query || !entry.language) errors.push(`${entry.id}: Suchtext oder Sprache fehlt`);
    return {
      id: entry.id, group: entry.group, language: entry.language, query: entry.query,
      form: entry.form ?? {}, expectEmpty: entry.expectEmpty === true, focus: entry.focus ?? null, source: 'ergaenzung',
    };
  }).filter(Boolean);

  const ids = new Set();
  for (const c of cases) {
    if (ids.has(c.id)) errors.push(`${c.id}: doppelt`);
    ids.add(c.id);
    const musts = sanitizeMusts(c.form);
    if (JSON.stringify(musts) !== JSON.stringify(normalizeForm(c.form))) errors.push(`${c.id}: Formularangaben würden von der API verändert`);
  }
  const expectedGroups = casesFile?.groups ?? {};
  const actualGroups = {};
  for (const c of cases) actualGroups[c.group] = (actualGroups[c.group] ?? 0) + 1;
  for (const [group, n] of Object.entries(expectedGroups)) {
    if ((actualGroups[group] ?? 0) !== n) errors.push(`Gruppe ${group}: ${actualGroups[group] ?? 0} statt ${n}`);
  }
  for (const group of Object.keys(actualGroups)) if (!(group in expectedGroups)) errors.push(`unbekannte Gruppe ${group}`);
  if (cases.length !== 36) errors.push(`${cases.length} statt 36 Fälle`);
  if (cases.filter((c) => c.source === 'ergaenzung').length !== 12) errors.push('nicht genau 12 Ergänzungen');
  return { cases, errors };
}

function normalizeForm(form) {
  const out = {};
  if (form?.canton) { out.canton = form.canton; out.onlineAllowed = form.onlineAllowed === true; }
  if (Number.isFinite(form?.maxBudget) && form.maxBudget > 0) out.maxBudget = Math.round(form.maxBudget);
  return out;
}

/**
 * Geschätzte Kosten einer Suche: Annahme je Suche, hochskaliert, falls die
 * tatsächlichen Tokens darüber liegen; dazu das Abfrage-Embedding.
 */
export function estimateSearchUsd(usage) {
  const factor = Math.max(1,
    (usage?.lunaInputTokens ?? 0) / SEARCH_ASSUMPTION.inputTokens,
    (usage?.lunaOutputTokens ?? 0) / SEARCH_ASSUMPTION.outputTokens);
  const embeddingUsd = ((usage?.embeddingTokens ?? 0) / 1_000_000) * OPS_PRICES.embeddingUsdPerMillion;
  return { usd: SEARCH_ASSUMPTION.usd * factor + embeddingUsd, factor };
}

/** Darf die nächste Suche noch starten? (Grenze inklusive der nächsten Suche) */
export function canStartNext({ spentUsd, maxFactor, maxUsd }) {
  return spentUsd + SEARCH_ASSUMPTION.usd * Math.max(1, maxFactor) <= maxUsd;
}

export function checkRunArgs(argv, env) {
  const execute = argv.includes('--execute');
  const maxArg = argv.find((a) => a.startsWith('--max-usd='));
  const unknown = argv.filter((a) => a !== '--execute' && !a.startsWith('--max-usd='));
  const errors = [];
  if (unknown.length) errors.push(`unbekannte Optionen: ${unknown.join(' ')}`);
  const maxUsd = maxArg ? Number(maxArg.split('=')[1]) : null;
  if (execute) {
    if (!Number.isFinite(maxUsd) || maxUsd <= 0) errors.push('--max-usd=<Grenze> ist Pflicht');
    else if (maxUsd > MAX_USD_CEILING) errors.push(`--max-usd über der Höchstgrenze ${MAX_USD_CEILING}`);
    if (env?.AI_QUALITY_CONFIRM !== EXPECTED_TEST_REF) errors.push(`AI_QUALITY_CONFIRM=${EXPECTED_TEST_REF} fehlt`);
  }
  return { execute, maxUsd, errors };
}

/** Vorbedingungen für einen aussagekräftigen Lauf auf dem Abnahmebestand. */
export function qualityPreconditions(state, embeddingVersion) {
  const problems = [];
  if (state.publishedTotal === 0) problems.push('keine veröffentlichten Kurse');
  if (state.publishedOutside > 0) problems.push(`${state.publishedOutside} veröffentlichte Kurse ausserhalb des Abnahmebereichs (z. B. durch CI-Seed)`);
  if (state.docsOutside > 0) problems.push(`${state.docsOutside} Indexdokumente ausserhalb des Abnahmebereichs`);
  if (state.docsTotal !== state.publishedTotal) problems.push(`Index unvollständig (${state.docsTotal} Dokumente, ${state.publishedTotal} Kurse)`);
  if (state.pendingJobs > 0) problems.push(`${state.pendingJobs} offene Indexaufträge`);
  if (state.chunksEmbedded !== state.chunksTotal || state.chunksOtherVersion > 0) problems.push(`Embeddings unvollständig (${state.chunksEmbedded}/${state.chunksTotal}, andere Version ${state.chunksOtherVersion})`);
  if (state.activeModelVersion !== embeddingVersion) problems.push(`aktive Modellversion ${state.activeModelVersion} ≠ ${embeddingVersion}`);
  return problems;
}

/** Automatisch prüfbare Punkte je Fall (die Relevanz bewertet ein Mensch). */
export function autoChecks(testCase, result) {
  const cards = [...(result?.results ?? []), ...(result?.incompleteResults ?? [])];
  const tooLong = cards.filter((c) => countWords(c.explanation) > MAX_EXPLANATION_WORDS).map((c) => c.courseId);
  const outside = cards.filter((c) => Number(c.courseId) < ACCEPTANCE_RANGE.min || Number(c.courseId) > ACCEPTANCE_RANGE.max).map((c) => c.courseId);
  const failedMust = cards.filter((c) => c.mustStatus === 'failed').map((c) => c.courseId);
  const confirmedWithMust = Object.keys(sanitizeMusts(testCase.form)).length > 0
    ? (result?.results ?? []).filter((c) => c.mustStatus !== 'confirmed').map((c) => c.courseId)
    : [];
  return {
    cards: cards.length,
    confirmed: (result?.results ?? []).length,
    incomplete: (result?.incompleteResults ?? []).length,
    emptyAsExpected: testCase.expectEmpty ? cards.length === 0 : null,
    explanationsTooLong: tooLong,
    foreignCourses: outside,
    mustFailedShown: failedMust,
    confirmedWithoutConfirmedMust: confirmedWithMust,
  };
}

/**
 * K3: Wo ist jeder fehlende Soll-Kurs ausgeschieden? Nur aus den
 * gespeicherten Auswahlstufen (keine Vermutung): nicht unter den Kandidaten,
 * Muss-Verstoss, nicht an Luna gesendet, Score unter der Mindestpassung,
 * nicht ausgewählt.
 */
export function analyzeSoll(soll, cards, diagnostics) {
  const shown = new Set((cards ?? []).map((c) => String(c.courseId)));
  const byId = new Map((diagnostics?.candidates ?? []).map((c) => [String(c.courseId), c]));
  const wanted = (soll ?? []).map(String).slice(0, 10);
  const found = wanted.filter((id) => shown.has(id));
  const missing = wanted.filter((id) => !shown.has(id)).map((id) => {
    const c = byId.get(id);
    if (!c) return { courseId: id, stage: 'nicht_unter_kandidaten' };
    if (c.must === 'failed') return { courseId: id, stage: 'muss_verstoss', detail: c.mustFailures, fusedRank: c.fusedRank };
    if (c.sentToLuna === false) return { courseId: id, stage: 'nicht_an_luna', fusedRank: c.fusedRank, lexicalChunkRank: c.lexicalChunkRank, lexicalDocumentRank: c.lexicalDocumentRank, semanticRank: c.semanticRank };
    if (c.rated && c.score !== null && c.score < (diagnostics.minScore ?? 70)) return { courseId: id, stage: 'score_unter_mindestpassung', score: c.score, fusedRank: c.fusedRank };
    if (!c.rated) return { courseId: id, stage: 'nicht_bewertet', fusedRank: c.fusedRank };
    return { courseId: id, stage: 'nicht_ausgewaehlt', score: c.score, fusedRank: c.fusedRank };
  });
  return { soll: wanted.length, found: found.length, coverage: wanted.length ? found.length / wanted.length : null, missing };
}

function sourceId(courseId) {
  return Number(courseId) - ID_OFFSET;
}

/** Bewertungsvorlage (Markdown) — nur für den privaten Speicher. */
export function buildReviewMarkdown(meta, runs) {
  const lines = [
    `# Qualitätsabnahme KI-Suche — Bewertungsvorlage`,
    '',
    `Lauf ${meta.startedAt}, Katalog ${meta.catalog}, Konfiguration ${meta.config}. Je Karte: Relevanz 2/1/0, jede Aussage belegt (ja/nein), Muss-Verstoss, Zielgruppe korrekt.`,
    '',
  ];
  for (const run of runs) {
    lines.push(`## ${run.case.id} (${run.case.group}, ${run.case.language})`, '', `Suchtext: ${run.case.query}`, `Formular-Muss: ${JSON.stringify(run.case.form)}`);
    if (run.case.focus) lines.push(`Prüfziel: ${run.case.focus}`);
    if (run.error) { lines.push('', `FEHLER: ${run.error}`, ''); continue; }
    lines.push(`Automatisch: ${JSON.stringify(run.checks)}`, '', '| # | Bereich | Kurs (Prod-ID) | Titel | Score | Begründung | Relevanz | belegt | Muss ok | Zielgruppe ok |', '|---|---|---|---|---|---|---|---|---|---|');
    run.cards.forEach((card, index) => {
      const text = String(card.explanation ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
      lines.push(`| ${index + 1} | ${card.section} | ${card.courseId} (${sourceId(card.courseId)}) | ${String(card.title).replace(/\|/g, '/')} | ${card.score} | ${text} |  |  |  |  |`);
    });
    if (run.cards.length === 0) lines.push('| – | – | keine Treffer | | | | | | | |');
    if (run.soll) {
      lines.push('', `Soll-Abdeckung: ${run.soll.found}/${run.soll.soll}`);
      for (const miss of run.soll.missing) lines.push(`- fehlt ${miss.courseId} (${sourceId(miss.courseId)}): ${miss.stage}${miss.score !== undefined ? `, Score ${miss.score}` : ''}${miss.fusedRank ? `, Fusionsrang ${miss.fusedRank}` : ''}${miss.semanticRank !== undefined ? `, Bedeutungsrang ${miss.semanticRank ?? '–'}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Verschlüsselte Ablage für die Auswertung (öffentliches Repository):
 * AES-256-GCM mit Zufallsschlüssel, dieser per RSA-OAEP (SHA-256) mit dem
 * öffentlichen Schlüssel aus scripts/keys verschlüsselt. Der private
 * Schlüssel liegt nicht im Repository.
 */
export function encryptForReview(plaintext, publicKeyPem) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const wrapped = publicEncrypt({ key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
  return {
    format: 'ai-search-review@1', alg: 'RSA-OAEP-256+A256GCM',
    key: wrapped.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64'),
  };
}

export function decryptForReview(envelope, privateKeyPem) {
  const key = privateDecrypt({ key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(envelope.key, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8');
}

async function readState(db) {
  const head = async (table, apply) => {
    let q = db.from(table).select('*', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  };
  const outside = (column) => (q) => q.or(`${column}.lt.${ACCEPTANCE_RANGE.min},${column}.gt.${ACCEPTANCE_RANGE.max}`);
  const { data: config } = await db.from('ai_search_config').select('active_model_version').eq('id', 1).maybeSingle();
  const active = config?.active_model_version ?? null;
  return {
    publishedTotal: await head('courses', (q) => q.eq('status', 'published')),
    publishedOutside: await head('courses', (q) => outside('id')(q.eq('status', 'published'))),
    docsTotal: await head('ai_search_documents'),
    docsOutside: await head('ai_search_documents', outside('course_id')),
    pendingJobs: await head('ai_search_jobs', (q) => q.eq('status', 'pending')),
    chunksTotal: await head('ai_search_chunks'),
    chunksEmbedded: await head('ai_search_chunks', (q) => q.not('embedding', 'is', null)),
    chunksOtherVersion: active ? await head('ai_search_chunks', (q) => q.neq('model_version', active)) : 0,
    activeModelVersion: active,
  };
}

async function main() {
  const args = checkRunArgs(process.argv.slice(2), process.env);
  if (args.errors.length) { args.errors.forEach((e) => console.error(`Abbruch: ${e}`)); process.exit(2); }
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }

  const { cases, errors } = loadQualityCases(JSON.parse(readFileSync(CASES_PATH, 'utf8')), JSON.parse(readFileSync(STARTSET_PATH, 'utf8')));
  const sollLists = JSON.parse(readFileSync(SOLL_PATH, 'utf8')).cases ?? {};
  if (errors.length) { errors.forEach((e) => console.error(`Fälle: ${e}`)); process.exit(2); }
  const env = { ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST };
  const config = readModelConfig(env);
  const configLabel = `Luna ${config.lunaModel}, Denkstufe ${config.lunaReasoningEffort}, Teilgrösse ${config.lunaBatchSize}, Verteilung ${config.lunaDistribution}, Ablauf ${config.lunaMode}, Embedding ${config.embeddingVersion}`;
  console.log(`Qualitätsabnahme: ${cases.length} Fälle, je 1 Lauf. ${configLabel}`);
  for (const c of cases) console.log(`  ${c.id.padEnd(16)} ${c.group.padEnd(16)} ${c.language} Formular ${JSON.stringify(sanitizeMusts(c.form))}`);
  const planUsd = cases.length * SEARCH_ASSUMPTION.usd;
  console.log(`Kostenschätzung: ${cases.length} × USD ${SEARCH_ASSUMPTION.usd} ≈ USD ${planUsd.toFixed(3)} (Annahme je Suche, Preisliste 13.11.2026)`);

  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });
  const state = await readState(service);
  console.log(`TEST: ${JSON.stringify(state)}`);
  const problems = qualityPreconditions(state, config.embeddingVersion);
  problems.forEach((p) => console.log(`Vorbedingung NICHT erfüllt: ${p}`));

  if (!args.execute) { console.log('TROCKENLAUF: keine Modellaufrufe.'); if (problems.length) process.exitCode = 1; return; }
  if (!config.enabled) { console.error(`Abbruch: ${config.reason}`); process.exit(2); }
  if (problems.length) { console.error('Abbruch: Vorbedingungen nicht erfüllt — kein Modellaufruf.'); process.exit(1); }
  if (planUsd > args.maxUsd) { console.error(`Abbruch: Schätzung USD ${planUsd.toFixed(3)} über Grenze ${args.maxUsd}.`); process.exit(2); }

  const startedAt = new Date().toISOString();
  const runs = [];
  let spentUsd = 0;
  let maxFactor = 1;
  let errorCount = 0;
  let stoppedBy = null;
  for (const testCase of cases) {
    if (!canStartNext({ spentUsd, maxFactor, maxUsd: args.maxUsd })) { stoppedBy = 'usd'; break; }
    if (errorCount >= MAX_ERRORS) { stoppedBy = 'errors'; break; }
    const gateway = createOpenAiGateway({
      apiKey: process.env.OPENAI_API_KEY, embeddingModel: config.embeddingModel, reasoningEffort: config.lunaReasoningEffort,
      batchSize: config.lunaBatchSize, distribution: config.lunaDistribution, mode: config.lunaMode,
    });
    const started = Date.now();
    const run = { case: testCase, cards: [], checks: null, error: null };
    try {
      const result = await runAiSearch(service, { query: testCase.query, musts: sanitizeMusts(testCase.form), models: { gateway, embeddingVersion: config.embeddingVersion }, diagnostics: true });
      run.cards = [
        ...result.results.map((c) => ({ ...c, section: 'Treffer' })),
        ...result.incompleteResults.map((c) => ({ ...c, section: 'unvollständig' })),
      ];
      run.checks = autoChecks(testCase, result);
      run.stats = result.stats;
      run.method = { semantic: result.method.semantic, luna: result.method.luna };
      run.timings = result.timings;
      run.language = result.criteria?.language ?? null;
      run.diagnostics = result.diagnostics ?? null;
      run.soll = analyzeSoll(sollLists[testCase.id]?.soll ?? [], run.cards, run.diagnostics);
    } catch (error) {
      errorCount += 1;
      run.error = String(error?.message ?? error).slice(0, 300);
    }
    const cost = estimateSearchUsd(gateway.usage);
    spentUsd += cost.usd;
    maxFactor = Math.max(maxFactor, cost.factor);
    run.usage = { lunaInputTokens: gateway.usage.lunaInputTokens, lunaOutputTokens: gateway.usage.lunaOutputTokens, embeddingTokens: gateway.usage.embeddingTokens, lunaCalls: gateway.usage.lunaCalls, lunaFailedCalls: gateway.usage.lunaFailedCalls, estimatedUsd: cost.usd };
    run.ms = Date.now() - started;
    runs.push(run);
    const top = run.cards.slice(0, 10).map((c) => `${c.courseId}:${c.score}`).join(' ');
    console.log(`${testCase.id}: ${run.error ? `FEHLER ${run.error}` : `Treffer ${run.checks.confirmed}, unvollständig ${run.checks.incomplete}, semantisch ${run.method.semantic ? 'ja' : 'NEIN'}, Luna ${run.method.luna ? 'ja' : 'NEIN'}`} | ${run.ms} ms | Tokens ${run.usage.lunaInputTokens}/${run.usage.lunaOutputTokens} | ≈ USD ${cost.usd.toFixed(4)} | ${top}`);
    if (run.soll && run.soll.soll > 0) {
      const stages = run.soll.missing.reduce((acc, m) => ({ ...acc, [m.stage]: (acc[m.stage] ?? 0) + 1 }), {});
      console.log(`  Soll ${run.soll.found}/${run.soll.soll}${run.soll.missing.length ? ` | fehlend nach Stufe ${JSON.stringify(stages)}` : ''}`);
    }
    if (run.checks) {
      const flags = [];
      if (run.checks.explanationsTooLong.length) flags.push(`zu lang ${run.checks.explanationsTooLong.join(',')}`);
      if (run.checks.foreignCourses.length) flags.push(`FREMDE KURSE ${run.checks.foreignCourses.join(',')}`);
      if (run.checks.mustFailedShown.length || run.checks.confirmedWithoutConfirmedMust.length) flags.push('MUSS-BEFUND');
      if (run.checks.emptyAsExpected === false) flags.push('Leermeldung erwartet');
      if (flags.length) console.log(`  Auffällig: ${flags.join('; ')}`);
    }
  }

  const summary = {
    startedAt, finishedAt: new Date().toISOString(), config: configLabel, maxUsd: args.maxUsd, stoppedBy,
    executed: runs.length, errors: errorCount, estimatedUsd: Number(spentUsd.toFixed(4)),
    tokens: runs.reduce((acc, r) => ({ in: acc.in + r.usage.lunaInputTokens, out: acc.out + r.usage.lunaOutputTokens }), { in: 0, out: 0 }),
  };
  const folder = `${QUALITY_PREFIX}/${startedAt.replace(/[:.]/g, '-')}`;
  const payload = { summary, runs: runs.map((r) => ({ ...r, cards: r.cards.map((c) => ({ courseId: c.courseId, title: c.title, section: c.section, score: c.score, explanation: c.explanation, reasons: c.reasons, gaps: c.gaps, mustStatus: c.mustStatus, wishChecks: c.wishChecks, event: c.event, price: c.price, place: c.place })) })) };
  const review = buildReviewMarkdown({ startedAt, catalog: `Abnahmebestand (Prod-ID + ${ID_OFFSET})`, config: configLabel }, payload.runs);
  for (const [name, body, type] of [['ergebnisse.json', JSON.stringify(payload), 'application/json'], ['bewertung.md', review, 'text/markdown']]) {
    const { error } = await service.storage.from(BACKUP_BUCKET).upload(`${folder}/${name}`, Buffer.from(body, 'utf8'), { contentType: type, upsert: false });
    if (error) console.error(`Speichern ${name} fehlgeschlagen: ${error.message}`);
  }
  if (process.env.AI_RESULTS_PUBLIC_KEY_PATH && process.env.AI_RESULTS_OUT) {
    try {
      const envelope = encryptForReview(JSON.stringify({ payload, review }), readFileSync(process.env.AI_RESULTS_PUBLIC_KEY_PATH, 'utf8'));
      writeFileSync(process.env.AI_RESULTS_OUT, JSON.stringify(envelope));
      console.log(`Verschlüsselte Kopie für die Auswertung: ${process.env.AI_RESULTS_OUT}`);
    } catch (error) {
      console.error(`Verschlüsselte Kopie fehlgeschlagen: ${error?.message ?? error}`);
    }
  }
  console.log(`\nZusammenfassung: ${JSON.stringify(summary)}`);
  console.log(`Ergebnisse und Bewertungsvorlage: privater Bucket ${BACKUP_BUCKET}, Ordner ${folder}`);
  if (stoppedBy || errorCount > 0 || runs.length !== cases.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
}
