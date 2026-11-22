/**
 * Qualitätsabnahme: 36 Fälle, Formular-Muss, Kostengrenze, Vorbedingungen
 * und automatische Prüfpunkte — ohne Netz und ohne Modellaufruf.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CASES_PATH, STARTSET_PATH, CANTON_BY_CODE, SEARCH_ASSUMPTION, formFromExpected, loadQualityCases,
  estimateSearchUsd, canStartNext, checkRunArgs, qualityPreconditions, autoChecks, buildReviewMarkdown,
} from '../scripts/ai-search-quality-run.mjs';

const casesFile = JSON.parse(readFileSync(CASES_PATH, 'utf8'));
const startset = JSON.parse(readFileSync(STARTSET_PATH, 'utf8'));

describe('36 Qualitätsfälle', () => {
  const { cases, errors } = loadQualityCases(casesFile, startset);

  it('genau 36 Fälle, 24 Startaufgaben + 12 Ergänzungen, Gruppen wie im Prüfplan', () => {
    expect(errors).toEqual([]);
    expect(cases).toHaveLength(36);
    expect(cases.filter((c) => c.source === 'startset')).toHaveLength(24);
    expect(new Set(cases.filter((c) => c.source === 'startset').map((c) => c.id))).toEqual(new Set(startset.tasks.map((t) => t.id)));
    const groups = {};
    for (const c of cases) groups[c.group] = (groups[c.group] ?? 0) + 1;
    expect(groups).toEqual({ alltag: 10, fr_it: 10, muss: 4, verneinung: 2, preis_unbekannt: 2, kinder: 4, lernform_niveau: 2, nulltreffer: 2 });
  });

  it('Sprachen: 10 Fälle FR/IT, sonst Deutsch', () => {
    const fritCases = cases.filter((c) => c.group === 'fr_it');
    expect(fritCases.every((c) => ['fr', 'it'].includes(c.language))).toBe(true);
    expect(cases.filter((c) => c.group !== 'fr_it').every((c) => c.language === 'de')).toBe(true);
  });

  it('Startaufgaben: Formular-Muss wie in der Oberfläche abgeleitet', () => {
    const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
    expect(byId['de-beruf-003'].form).toEqual({ canton: 'Zürich', onlineAllowed: false, maxBudget: 8000 });
    expect(byId['de-beruf-006'].form).toEqual({ canton: 'St. Gallen', onlineAllowed: true, maxBudget: 500 });
    // Online ohne Kanton ist im Formular nicht ausdrückbar → nur Suchtext.
    expect(byId['de-beruf-002'].form).toEqual({});
    expect(byId['de-beruf-004'].form).toEqual({});
    // Budget 0 („gratis“) ist kein Formular-Budget.
    expect(byId['de-privat-003'].form).toEqual({});
    expect(byId['q-muss-004'].form).toEqual({ canton: 'Luzern', onlineAllowed: false, maxBudget: 200 });
  });

  it('jedes Kantonskürzel der Startaufgaben ist abgebildet; Namen wie im Formular', () => {
    const codes = startset.tasks.map((t) => t.expected?.musts?.location).filter(Boolean);
    for (const code of codes) expect(CANTON_BY_CODE[code], code).toBeTruthy();
    const ui = readFileSync('src/components/AiSearchView.jsx', 'utf8');
    for (const name of Object.values(CANTON_BY_CODE)) expect(ui).toContain(`'${name}'`);
    expect(() => formFromExpected({ location: 'XX' })).toThrow(/Kantonskürzel/);
  });

  it('erkennt fehlende Startaufgaben, doppelte IDs und falsche Gruppengrössen', () => {
    const broken = { ...casesFile, cases: [...casesFile.cases.slice(1), casesFile.cases[10]] };
    const result = loadQualityCases(broken, startset);
    expect(result.errors.join(' ')).toMatch(/doppelt/);
    expect(result.errors.join(' ')).toMatch(/Gruppe alltag: 9 statt 10/);
    expect(loadQualityCases(casesFile, { tasks: [] }).errors.join(' ')).toMatch(/Startaufgabe/);
  });
});

describe('Kosten und Abbruch', () => {
  it('Schätzung je Suche skaliert mit Tokenüberschreitung', () => {
    expect(estimateSearchUsd({ lunaInputTokens: 13000, lunaOutputTokens: 1300, embeddingTokens: 0 }).usd).toBeCloseTo(SEARCH_ASSUMPTION.usd);
    const big = estimateSearchUsd({ lunaInputTokens: 36000, lunaOutputTokens: 1000, embeddingTokens: 0 });
    expect(big.factor).toBe(2);
    expect(big.usd).toBeCloseTo(SEARCH_ASSUMPTION.usd * 2);
  });

  it('nächste Suche nur, wenn die Grenze inklusive dieser Suche hält', () => {
    expect(canStartNext({ spentUsd: 0.498, maxFactor: 1, maxUsd: 0.5 })).toBe(false);
    expect(canStartNext({ spentUsd: 0.10, maxFactor: 1, maxUsd: 0.5 })).toBe(true);
    expect(canStartNext({ spentUsd: 0.498, maxFactor: 1, maxUsd: 0.498 + SEARCH_ASSUMPTION.usd })).toBe(true);
  });

  it('Ausführung nur mit Grenze ≤ 1 und Bestätigung', () => {
    expect(checkRunArgs([], {}).errors).toEqual([]);
    expect(checkRunArgs(['--execute'], { AI_QUALITY_CONFIRM: 'omoapbvfligjfznzivyu' }).errors.join(' ')).toMatch(/max-usd/);
    expect(checkRunArgs(['--execute', '--max-usd=2'], { AI_QUALITY_CONFIRM: 'omoapbvfligjfznzivyu' }).errors.join(' ')).toMatch(/Höchstgrenze/);
    expect(checkRunArgs(['--execute', '--max-usd=0.5'], {}).errors.join(' ')).toMatch(/AI_QUALITY_CONFIRM/);
    expect(checkRunArgs(['--execute', '--max-usd=0.5'], { AI_QUALITY_CONFIRM: 'omoapbvfligjfznzivyu' })).toEqual({ execute: true, maxUsd: 0.5, errors: [] });
  });

  it('kein Lauf bei fremden Kursen, unvollständigem Index oder fehlenden Embeddings', () => {
    const ok = { publishedTotal: 697, publishedOutside: 0, docsTotal: 697, docsOutside: 0, pendingJobs: 0, chunksTotal: 2400, chunksEmbedded: 2400, chunksOtherVersion: 0, activeModelVersion: 'm@1024' };
    expect(qualityPreconditions(ok, 'm@1024')).toEqual([]);
    expect(qualityPreconditions({ ...ok, publishedOutside: 1 }, 'm@1024').join(' ')).toMatch(/CI-Seed/);
    expect(qualityPreconditions({ ...ok, docsOutside: 2 }, 'm@1024').join(' ')).toMatch(/ausserhalb/);
    expect(qualityPreconditions({ ...ok, docsTotal: 690 }, 'm@1024').join(' ')).toMatch(/unvollständig/);
    expect(qualityPreconditions({ ...ok, chunksEmbedded: 10 }, 'm@1024').join(' ')).toMatch(/Embeddings/);
    expect(qualityPreconditions(ok, 'andere@1536').join(' ')).toMatch(/Modellversion/);
  });
});

describe('automatische Prüfpunkte und Bewertungsvorlage', () => {
  const card = (id, extra = {}) => ({ courseId: id, title: `Kurs ${id}`, score: 85, explanation: 'Kurz und belegt.', mustStatus: 'confirmed', ...extra });

  it('meldet fremde Kurse, zu lange Texte und erwartete Leermeldungen', () => {
    const result = { results: [card(20001), card(10022)], incompleteResults: [card(20002, { mustStatus: 'incomplete', explanation: 'wort '.repeat(60) })] };
    const checks = autoChecks({ form: { canton: 'Bern' }, expectEmpty: true }, result);
    expect(checks).toMatchObject({ cards: 3, confirmed: 2, incomplete: 1, emptyAsExpected: false, foreignCourses: [10022], explanationsTooLong: [20002], mustFailedShown: [] });
    expect(autoChecks({ form: {}, expectEmpty: true }, { results: [], incompleteResults: [] }).emptyAsExpected).toBe(true);
  });

  it('Vorlage nennt Abnahme- und Produktions-ID und lässt Bewertungsspalten leer', () => {
    const md = buildReviewMarkdown({ startedAt: 't', catalog: 'c', config: 'k' }, [
      { case: { id: 'q-1', group: 'muss', language: 'de', query: 'Yoga', form: { canton: 'Bern' }, focus: 'x' }, checks: {}, cards: [{ ...card(20123), section: 'Treffer' }] },
      { case: { id: 'q-2', group: 'nulltreffer', language: 'de', query: 'xyz', form: {} }, checks: {}, cards: [] },
    ]);
    expect(md).toContain('| 1 | Treffer | 20123 (123) | Kurs 20123 | 85 |');
    expect(md).toContain('keine Treffer');
  });
});

describe('verschlüsselte Ergebnisablage (öffentliches Repository)', () => {
  it('Rundweg mit eigenem Schlüsselpaar; Klartext nicht im Umschlag', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const { encryptForReview, decryptForReview } = await import('../scripts/ai-search-quality-run.mjs');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    const text = JSON.stringify({ title: 'Yoga für Einsteiger in Bern' });
    const envelope = encryptForReview(text, publicKey);
    expect(JSON.stringify(envelope)).not.toContain('Yoga');
    expect(decryptForReview(envelope, privateKey)).toBe(text);
  });

  it('im Repository liegt nur der öffentliche Schlüssel', async () => {
    const { createPublicKey } = await import('node:crypto');
    const pem = readFileSync('scripts/keys/ai-acceptance-results.pub.pem', 'utf8');
    expect(pem).toContain('BEGIN PUBLIC KEY');
    expect(pem).not.toContain('PRIVATE');
    expect(createPublicKey(pem).asymmetricKeyDetails.modulusLength).toBeGreaterThanOrEqual(4096);
  });
});
