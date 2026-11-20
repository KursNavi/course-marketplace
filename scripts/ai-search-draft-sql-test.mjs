/**
 * Setzt den SQL-Test zum Migrationsentwurf 20261120090000 zusammen.
 *
 * Der Test ist EIN DO-Block, der am Ende immer eine Ausnahme auslöst
 * (AI_DRAFT_TEST_OK … bzw. AI_DRAFT_TEST_FAIL …). Dadurch werden Entwurf,
 * Testdaten und Rückweg vollständig zurückgerollt – der Entwurf wird also
 * NICHT angewendet. Dieses Skript ersetzt nur die Marker @@MIGRATION@@ und
 * @@ROLLBACK@@ durch je ein EXECUTE pro Anweisung der Entwurfsdateien.
 *
 * Aufruf:  node scripts/ai-search-draft-sql-test.mjs > test.sql
 * Ausführung nur gegen die TESTumgebung und nur nach Absprache.
 * Es baut selbst keine Datenbankverbindung auf.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRAFT = 'supabase/drafts/20261120090000_ai_search_keep_embeddings_skip_noop_jobs';

/**
 * Zerlegt SQL in einzelne Anweisungen. Beachtet Dollar-Quoting ($tag$),
 * einfache Anführungszeichen und Zeilenkommentare.
 */
export function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let dollarTag = null;
  let inQuote = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { current += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      current += ch; i += 1; continue;
    }
    if (inQuote) {
      current += ch; i += 1;
      if (ch === "'") { if (sql[i] === "'") { current += "'"; i += 1; } else inQuote = false; }
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end + 1;
      current += '\n';
      continue;
    }
    if (ch === "'") { inQuote = true; current += ch; i += 1; continue; }
    if (ch === '$') {
      const match = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (match) { dollarTag = match[0]; current += dollarTag; i += dollarTag.length; continue; }
    }
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = ''; i += 1; continue;
    }
    current += ch; i += 1;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function asExecutes(statements, label) {
  return statements.map((statement, index) => {
    const tag = `$${label}${index}$`;
    if (statement.includes(tag)) throw new Error(`Dollar-Tag ${tag} kommt im SQL vor.`);
    // Zeilenumbruch vor dem schliessenden Tag: sonst verschmilzt ein
    // Statement-Ende wie „$function$“ mit dem Tag zu „$function$mig0$“
    // und PostgreSQL beendet den String ein Zeichen zu früh.
    return `EXECUTE ${tag}${statement}\n${tag};`;
  }).join('\n  ');
}

export function composeDraftTest(root = ROOT) {
  const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
  const migration = splitSqlStatements(read(`${DRAFT}.sql`));
  const rollback = splitSqlStatements(read(`${DRAFT}_down.sql`));
  const test = read('supabase/drafts/tests/20261120090000_ai_search_keep_embeddings_skip_noop_jobs_test.sql');
  if (!test.includes('-- @@MIGRATION@@') || !test.includes('-- @@ROLLBACK@@')) throw new Error('Marker fehlen im Test.');
  return {
    migration,
    rollback,
    sql: test
      .replace('-- @@MIGRATION@@', asExecutes(migration, 'mig'))
      .replace('-- @@ROLLBACK@@', asExecutes(rollback, 'down')),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(composeDraftTest().sql);
}
