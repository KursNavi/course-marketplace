/**
 * Ausführungsweg der Produktionsmigrationen (Produktionspaket 25.11.2026):
 * nur Produktionsziel, feste Prüfsummen, richtige Transaktionsart, lückenlose
 * Wiederaufnahme, Workflow nur manuell vom main mit Freigabe-Umgebung.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MIGRATIONS, EXPECTED_MD5, fileOf, md5Of, checkDbTarget, planMigrations, psqlApplyArgs, FINAL_EXPECTED, finalSql, checkNotAlreadyPresent } from '../scripts/ai-search-prod-migrate.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const REF = 'nplxmpfasgpumpiddjfl';

describe('Produktionsmigrationen', () => {
  it('die 7 KI-Migrationen und M8 (Erwachsenenregel) in Reihenfolge, feste Prüfsummen passen zu den Dateien', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(['20261114205850', '20261114205915', '20261114205947', '20261115200229', '20261120205856', '20261121122101', '20261121225750', '20261127120000']);
    for (const m of MIGRATIONS) expect(md5Of(fileOf(m)).startsWith(EXPECTED_MD5[m.version])).toBe(true);
    // M1–M7 unverändert (bereits in Produktion angewendet).
    expect(EXPECTED_MD5).toMatchObject({ '20261114205850': 'a2c5e303', '20261121225750': 'aa555cb0', '20261127120000': 'ad4d9e9a' });
    const m8 = MIGRATIONS[7];
    expect(m8).toMatchObject({ name: 'account_adult_confirmations', ownTransaction: false });
    expect(m8.marker).toMatch(/account_adult_confirmations/);
    expect(m8.marker).toMatch(/on_auth_user_adult_confirmation/);
  });

  it('M1–M7 verbucht: Plan ist genau M8; nichts wird erneut ausgeführt', () => {
    const appliedM1toM7 = MIGRATIONS.slice(0, 7).map((m) => m.version);
    expect(planMigrations(appliedM1toM7)).toEqual({ pending: [MIGRATIONS[7]], gap: false });
    // Nach M8 nichts mehr zu tun; M8 ohne M7 wäre eine Lücke.
    expect(planMigrations([...appliedM1toM7, '20261127120000'])).toEqual({ pending: [], gap: false });
    expect(planMigrations([...MIGRATIONS.slice(0, 6).map((m) => m.version), '20261127120000']).gap).toBe(true);
  });

  it('unverbuchte, aber vorhandene Objekte stoppen (keine Doppelausführung)', () => {
    expect(checkNotAlreadyPresent('t', MIGRATIONS[7]).ok).toBe(false);
    expect(checkNotAlreadyPresent('t', MIGRATIONS[7]).reason).toMatch(/keine erneute Ausführung/);
    expect(checkNotAlreadyPresent('f', MIGRATIONS[7])).toEqual({ ok: true });
  });

  it('Nachkontrolle M8: Tabelle, RLS, Trigger, keine Rechte für anon/authenticated, keine Einträge für bestehende Konten', () => {
    const sql = finalSql('2026-11-27 12:00:00+00');
    for (const key of Object.keys(FINAL_EXPECTED)) expect(sql).toContain(`'${key}'`);
    expect(sql).toMatch(/u\.created_at < '2026-11-27 12:00:00\+00'::timestamptz/);
    expect(sql).toMatch(/has_function_privilege\(r\.rolle, 'public\.record_signup_adult_confirmation\(\)', 'EXECUTE'\)/);
  });

  it('Transaktionsart: M1–M4 eigene Transaktion (in der Datei), M5–M7 mit --single-transaction', () => {
    for (const m of MIGRATIONS) {
      const source = readFileSync(fileOf(m), 'utf8');
      const hasOwn = /^\s*BEGIN;/m.test(source) && /^\s*COMMIT;/m.test(source);
      expect(m.ownTransaction).toBe(hasOwn);
      expect(psqlApplyArgs(m).includes('--single-transaction')).toBe(!hasOwn);
      expect(psqlApplyArgs(m)).toContain('ON_ERROR_STOP=1');
    }
  });

  it('Ziel nur Produktion (direkt oder Pooler mit Projektbenutzer), nie TEST oder andere', () => {
    expect(checkDbTarget(`postgresql://postgres.${REF}:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`)).toEqual({ ok: true });
    expect(checkDbTarget(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`)).toEqual({ ok: true });
    expect(checkDbTarget('postgresql://postgres.omoapbvfligjfznzivyu:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres').ok).toBe(false);
    expect(checkDbTarget('postgresql://postgres:pw@db.omoapbvfligjfznzivyu.supabase.co:5432/postgres').ok).toBe(false);
    expect(checkDbTarget(`https://${REF}.supabase.co`).ok).toBe(false);
    expect(checkDbTarget(undefined).ok).toBe(false);
  });

  it('Wiederaufnahme: bereits verbuchte überspringen; Lücke in der Reihenfolge stoppt', () => {
    expect(planMigrations([]).pending).toHaveLength(8);
    expect(planMigrations(['20261114205850', '20261114205915'])).toMatchObject({ gap: false });
    expect(planMigrations(['20261114205850', '20261114205915']).pending.map((m) => m.version)[0]).toBe('20261114205947');
    expect(planMigrations(['20261114205850', '20261114205947']).gap).toBe(true);
    expect(planMigrations(MIGRATIONS.map((m) => m.version))).toEqual({ pending: [], gap: false });
  });

  it('Sollwerte der Gesamtprüfung: M1–M7 wie TEST, dazu M8', () => {
    expect(FINAL_EXPECTED).toEqual({
      tabellen: 8, funktionen: 30, trigger: 4, policies: 0, lesbar_anon_auth: 0, historie: 8,
      adult_tabelle: 1, adult_rls: 1, adult_trigger: 1, adult_policies: 0, adult_rechte_anon_auth: 0, adult_funktion_anon_auth: 0, adult_bestehende_konten: 0,
    });
  });

  it('Workflow: nur manuell vom main, Freigabe-Umgebung, Plan als Standard, Zugang nur als Secret', () => {
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-prod-migrations.yml'), 'utf8');
    expect(wf).toMatch(/^on:\n {2}workflow_dispatch:/m);
    expect(wf).not.toMatch(/^\s*(pull_request|pull_request_target|push|schedule|workflow_run):/m);
    expect(wf).toMatch(/if: github\.ref == 'refs\/heads\/main'/);
    expect(wf).toMatch(/environment: ki-produktion-migration/);
    expect(wf).toMatch(/default: plan/);
    expect(wf).toMatch(/SUPABASE_DB_URL_PROD: \$\{\{ secrets\.SUPABASE_DB_URL_PROD \}\}/);
    expect(wf.match(/--execute/g)).toHaveLength(1);
    expect(wf).not.toMatch(/db push|apply_migration|echo .*SUPABASE_DB_URL/);
  });
});
