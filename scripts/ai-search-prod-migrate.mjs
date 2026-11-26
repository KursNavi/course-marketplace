/**
 * Produktionsmigrationen der KI-Suche (M1–M7) – Ausführungsweg des
 * Produktionspakets 25.11.2026. Läuft im GitHub-Workflow
 * „KI-Suche Produktionsmigrationen“ (manuell, nur main, Umgebung mit
 * Pflichtfreigabe) mit dem psql des Runners.
 *
 * STANDARD = PLAN (lesend): prüft Ziel, Prüfsummen der 7 Dateien, Ausgangslage
 * (V0) und welche Dateien noch fehlen. Keine Schreibzugriffe.
 *
 *   node scripts/ai-search-prod-migrate.mjs            Plan
 *   node scripts/ai-search-prod-migrate.mjs --execute  Ausführung (AI_MIGRATE_CONFIRM=nplxmpfasgpumpiddjfl)
 *
 * Ausführung je fehlender Datei in fester Reihenfolge: anwenden (M1–M4 mit
 * eigener Transaktion, M5–M7 mit --single-transaction), verbuchen wie in TEST
 * (Version, Name ohne Präfix, Dateiinhalt als statements), Objektprüfung.
 * Erster Fehler → Stopp, keine weitere Datei. Wiederaufnahme: bereits
 * verbuchte Dateien werden übersprungen, Lücken in der Reihenfolge stoppen.
 *
 * Zugang: SUPABASE_DB_URL_PROD (Session Pooler, nur als GitHub-Secret). Die
 * Adresse wird nie ausgegeben; psql-Ausgaben werden ohne Zugangsdaten gezeigt.
 * Nicht: supabase db push, MCP apply_migration (falsche Versionen, Abschnitt 7.1).
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRODUCTION_REF } from '../src/lib/aiSearch/previewGuard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_VERSION = '20260926083826';

/** Die 7 KI-Migrationen in Anwendungsreihenfolge (md5 vollständig, 25.11.2026). */
export const MIGRATIONS = Object.freeze([
  { version: '20261114205850', name: 'ai_search_foundation', ownTransaction: true, marker: "select to_regclass('public.ai_search_jobs') is not null and to_regprocedure('public.ai_search_lexical(text,integer)') is not null" },
  { version: '20261114205915', name: 'ai_search_vector', ownTransaction: true, marker: "select exists (select 1 from information_schema.columns where table_name='ai_search_chunks' and column_name='embedding')" },
  { version: '20261114205947', name: 'ai_search_quota', ownTransaction: true, marker: "select to_regclass('public.ai_search_usage') is not null" },
  { version: '20261115200229', name: 'ai_search_worker_apply', ownTransaction: true, marker: "select to_regclass('public.ai_search_index_state') is not null" },
  { version: '20261120205856', name: 'ai_search_keep_embeddings_skip_noop_jobs', ownTransaction: false, marker: "select exists (select 1 from pg_trigger where tgname='ai_search_profiles_outbox')" },
  { version: '20261121122101', name: 'ai_search_result_store_and_guard', ownTransaction: false, marker: "select to_regclass('public.ai_search_results') is not null" },
  { version: '20261121225750', name: 'ai_search_ops_lease_v2', ownTransaction: false, marker: "select to_regclass('public.ai_search_ops_runs') is not null" },
]);

export const fileOf = (m) => path.join(ROOT, 'supabase', 'migrations', `${m.version}_${m.name}.sql`);
export const md5Of = (file) => createHash('md5').update(readFileSync(file)).digest('hex');

/** Erwartete md5-Werte (aus dem geprüften Branch-Stand); Abweichung = Stopp. */
export const EXPECTED_MD5 = Object.freeze({
  '20261114205850': 'a2c5e303',
  '20261114205915': 'ac275890',
  '20261114205947': 'd1810775',
  '20261115200229': '931f9bd0',
  '20261120205856': '10e563be',
  '20261121122101': 'c8061652',
  '20261121225750': 'aa555cb0',
});

/**
 * Ziel nur Produktion: db.<ref>.supabase.co oder Pooler mit Benutzer postgres.<ref>.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function checkDbTarget(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl ?? '').trim()); } catch { return { ok: false, reason: 'SUPABASE_DB_URL_PROD fehlt oder ist keine gültige Adresse.' }; }
  if (!/^postgres(ql)?:$/.test(url.protocol)) return { ok: false, reason: 'SUPABASE_DB_URL_PROD muss eine postgresql://-Adresse sein.' };
  const direct = url.hostname === `db.${PRODUCTION_REF}.supabase.co`;
  const pooler = /\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username) === `postgres.${PRODUCTION_REF}`;
  if (!direct && !pooler) return { ok: false, reason: 'SUPABASE_DB_URL_PROD zeigt nicht auf das Produktionsprojekt.' };
  return { ok: true };
}

/** Plan aus der verbuchten Historie: fehlende Dateien müssen ein lückenloser Schluss sein. */
export function planMigrations(appliedVersions) {
  const applied = new Set(appliedVersions);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version));
  const firstPending = MIGRATIONS.findIndex((m) => !applied.has(m.version));
  const gap = firstPending >= 0 && MIGRATIONS.slice(firstPending).some((m) => applied.has(m.version));
  return { pending, gap };
}

/** psql-Argumente für eine Datei (ohne Zugangsdaten; Adresse kommt über PGURL-Umgebung). */
export function psqlApplyArgs(migration) {
  return ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...(migration.ownTransaction ? [] : ['--single-transaction']), '-f', fileOf(migration)];
}

function redact(text, dbUrl) {
  let out = String(text ?? '');
  if (dbUrl) out = out.split(dbUrl).join('[DB-URL]');
  return out.replace(/postgres(ql)?:\/\/[^\s'"]+/g, '[DB-URL]').slice(0, 2000);
}

function psql(dbUrl, args, input) {
  const result = spawnSync('psql', [dbUrl, ...args], { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: redact(result.stderr, dbUrl), error: result.error };
}

function query(dbUrl, sql) {
  const r = psql(dbUrl, ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  if (!r.ok) throw new Error(`Abfrage fehlgeschlagen: ${r.stderr || r.error?.message}`);
  return r.stdout.trim();
}

const V0_SQL = `select json_build_object(
 'ai_rel', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\\_search%'),
 'last_version', (select max(version) from supabase_migrations.schema_migrations),
 'ai_versions', (select coalesce(json_agg(version order by version), '[]'::json) from supabase_migrations.schema_migrations where version in (${MIGRATIONS.map((m) => `'${m.version}'`).join(',')})),
 'null_status', (select count(*) from courses where status is null),
 'courses', (select count(*) from courses))`;

const FINAL_SQL = `select json_build_object(
 'tabellen', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\\_search%' and c.relkind='r'),
 'funktionen', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai\\_search%'),
 'trigger', (select count(*) from pg_trigger where tgname like 'ai\\_search%' and not tgisinternal),
 'policies', (select count(*) from pg_policies where schemaname='public' and tablename like 'ai\\_search%'),
 'lesbar_anon_auth', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\\_search%' and c.relkind='r' and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'SELECT'))),
 'historie', (select count(*) from supabase_migrations.schema_migrations where version in (${MIGRATIONS.map((m) => `'${m.version}'`).join(',')})),
 'courses', (select count(*) from courses))`;

/** Sollwerte nach M7 (TEST-Stand 25.11.2026). */
export const FINAL_EXPECTED = Object.freeze({ tabellen: 8, funktionen: 30, trigger: 4, policies: 0, lesbar_anon_auth: 0, historie: 7 });

async function main() {
  const execute = process.argv.includes('--execute');
  const unknown = process.argv.slice(2).filter((a) => a !== '--execute');
  if (unknown.length) { console.error(`Abbruch: unbekannte Angabe(n) ${unknown.join(' ')}`); process.exit(2); }
  const dbUrl = process.env.SUPABASE_DB_URL_PROD;
  const target = checkDbTarget(dbUrl);
  if (!target.ok) { console.error(`Abbruch: ${target.reason}`); process.exit(2); }
  if (execute && String(process.env.AI_MIGRATE_CONFIRM ?? '').trim() !== PRODUCTION_REF) { console.error(`Abbruch: Ausführung braucht AI_MIGRATE_CONFIRM=${PRODUCTION_REF}.`); process.exit(2); }

  // 1. Prüfsummen
  for (const m of MIGRATIONS) {
    const md5 = md5Of(fileOf(m));
    if (!md5.startsWith(EXPECTED_MD5[m.version])) { console.error(`Abbruch: Prüfsumme ${m.version} weicht ab (${md5.slice(0, 8)} statt ${EXPECTED_MD5[m.version]}).`); process.exit(2); }
  }
  console.log('Prüfsummen der 7 Dateien: ok');

  // 2. Ausgangslage
  const v0 = JSON.parse(query(dbUrl, V0_SQL));
  const plan = planMigrations(v0.ai_versions ?? []);
  console.log(`Ausgangslage: letzte Version ${v0.last_version}, KI-Objekte ${v0.ai_rel}, verbuchte KI-Versionen ${(v0.ai_versions ?? []).length}/7, Kurse ${v0.courses}, ohne Status ${v0.null_status}`);
  if (plan.gap) { console.error('Abbruch: Lücke in der Reihenfolge der verbuchten KI-Migrationen.'); process.exit(2); }
  if (Number(v0.null_status) > 0) { console.error('Abbruch: Kurse ohne Status vorhanden (Datenvertrag §1).'); process.exit(2); }
  if ((v0.ai_versions ?? []).length === 0 && (Number(v0.ai_rel) > 0 || v0.last_version !== BASELINE_VERSION)) {
    console.error(`Abbruch: Ausgangslage weicht ab (erwartet letzte Version ${BASELINE_VERSION} und 0 KI-Objekte).`);
    process.exit(2);
  }
  console.log(`Plan: ${plan.pending.length ? plan.pending.map((m) => `${m.version} ${m.ownTransaction ? '(eigene Transaktion)' : '(--single-transaction)'}`).join(', ') : 'nichts zu tun'}`);
  if (!execute) { console.log('PLAN: keine Schreibzugriffe.'); return; }

  // 3. Ausführung
  for (const m of plan.pending) {
    const applied = psql(dbUrl, psqlApplyArgs(m));
    if (!applied.ok) { console.error(`STOPP bei ${m.version}: ${applied.stderr || applied.error?.message}`); process.exit(1); }
    const record = psql(dbUrl, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '--set', `sql=${readFileSync(fileOf(m), 'utf8')}`],
      `insert into supabase_migrations.schema_migrations (version, name, statements) values ('${m.version}', '${m.name}', array[:'sql']);\n`);
    if (!record.ok) { console.error(`STOPP: Verbuchung ${m.version} fehlgeschlagen: ${record.stderr}`); process.exit(1); }
    if (query(dbUrl, m.marker) !== 't') { console.error(`STOPP: Prüfung nach ${m.version} nicht erfüllt.`); process.exit(1); }
    console.log(`${m.version} ${m.name}: angewendet, verbucht, geprüft`);
  }

  // 4. Gesamtprüfung
  const final = JSON.parse(query(dbUrl, FINAL_SQL));
  const deviations = Object.entries(FINAL_EXPECTED).filter(([key, value]) => Number(final[key]) !== value);
  console.log(`Gesamtprüfung: ${JSON.stringify(final)}`);
  if (Number(final.courses) !== Number(v0.courses)) deviations.push(['courses', v0.courses]);
  if (deviations.length) { console.error(`STOPP: Gesamtprüfung weicht ab: ${deviations.map(([k, v]) => `${k} (Soll ${v})`).join(', ')}`); process.exit(1); }
  console.log('Gesamtprüfung: ok');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Abbruch: ${redact(error?.message ?? error, process.env.SUPABASE_DB_URL_PROD)}`); process.exit(1); });
}
