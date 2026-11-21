/**
 * Versionszuordnung der KI-Suche-Migrationen (Stand 21.11.2026).
 *
 * Alle sechs KI-Migrationsdateien tragen die Version, unter der sie in der
 * TESTumgebung (supabase_migrations.schema_migrations) verbucht sind. Die
 * vier älteren wurden am 21.11.2026 nur UMBENANNT – der Inhalt muss byte-
 * gleich der angewendeten Fassung bleiben (md5 über LF-normalisierten Text).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DIR = path.resolve(__dirname, '..', 'supabase/migrations');

// Datei = verbuchte TEST-Version + Name; md5 = angewendete Fassung.
const EXPECTED = [
  ['20261114205850_ai_search_foundation.sql', 'a2c5e3035ead13a3fae398f37f7dd1d6'],
  ['20261114205915_ai_search_vector.sql', 'ac27589045f8918908a820841451077b'],
  ['20261114205947_ai_search_quota.sql', 'd181077577f50df1143305ad372fbbaf'],
  ['20261115200229_ai_search_worker_apply.sql', '931f9bd0e38fc623e03e0d7ab88a36c4'],
  ['20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql', '10e563be0260d4b7fa734673dee1e726'],
  ['20261121122101_ai_search_result_store_and_guard.sql', 'c8061652db3ecdd0439d30165416bc8d'],
];

const md5 = (file) => createHash('md5')
  .update(readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n/g, '\n'), 'utf8')
  .digest('hex');

describe('KI-Migrationen: Dateiversion = TEST-Historie', () => {
  it('genau diese sechs KI-Dateien, in Anwendungsreihenfolge', () => {
    const files = readdirSync(DIR).filter((f) => /_ai_search_/.test(f)).sort();
    expect(files).toEqual(EXPECTED.map(([f]) => f));
  });

  it.each(EXPECTED)('%s ist inhaltlich unverändert', (file, hash) => {
    expect(md5(file)).toBe(hash);
  });

  it('keine Kopie unter den alten Dateinummern', () => {
    const files = readdirSync(DIR);
    for (const old of ['20261113180000', '20261113180100', '20261113180200', '20261115190000', '20261121090000', '20261120090000']) {
      expect(files.some((f) => f.startsWith(old))).toBe(false);
    }
  });
});
