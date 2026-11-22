/**
 * Abnahmebestand (Paket 2): Positivliste, Pseudonymisierung, Prüfungen,
 * Sicherung/Rückweg und Abbruchbedingungen — ohne Netz und ohne Datenbank.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EXPORT_FIELDS, FORBIDDEN_FIELDS, ID_OFFSET, MAX_SOURCE_ID, PROVIDER_NAME_PREFIX, TAXONOMY_TABLES,
  classifySupabaseKey, validateSnapshot, buildImportRows, pseudonymUuid, diffTaxonomy, buildBackup,
  sealBackup, verifyBackup, compareIndexToBackup, planEmbeddingRestore, inAcceptanceRange, textMd5,
} from '../src/lib/aiSearch/acceptanceCatalog.js';
import {
  parseArgs, checkProdSource, checkWriteConfirm, switchPreconditions, restorePreconditions, backupClosed, archiveFolder,
} from '../scripts/ai-search-acceptance.mjs';

const SECRET = 'a'.repeat(64);
const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

function snapshot(overrides = {}) {
  return {
    exportedAt: '2026-11-22T18:00:00Z',
    courses: [
      { ...Object.fromEntries(EXPORT_FIELDS.courses.map((f) => [f, null])), id: 7, status: 'published', title: 'Kurs 7', user_id: 'prov-b', category_level3_id: 175 },
      { ...Object.fromEntries(EXPORT_FIELDS.courses.map((f) => [f, null])), id: 3, status: 'published', title: 'Kurs 3', user_id: 'prov-a' },
      { ...Object.fromEntries(EXPORT_FIELDS.courses.map((f) => [f, null])), id: 9, status: 'published', title: 'Kurs 9', user_id: 'prov-hidden' },
    ],
    course_events: [{ course_id: 7, start_date: '2027-01-10', end_date: null, location: 'Bern', canton: 'Bern', schedule_description: null, max_participants: null, cancelled_at: null, cancelled_reason: null }],
    course_locations: [{ course_id: 3, location_type: 'presence', street: 'Weg 1', city: 'Zürich', canton: 'Zürich', sort_order: 0 }],
    course_category_assignments: [{ course_id: 7, level3_id: 175, level4_id: 324, is_primary: true }],
    taxonomy_level1: [{ id: 1, icon: null, slug: 'a', label_de: 'A', label_en: null, label_fr: null, label_it: null, sort_order: 1, is_active: true }],
    taxonomy_level2: [{ id: 2, level1_id: 1, icon: null, slug: 'b', label_de: 'B', label_en: null, label_fr: null, label_it: null, sort_order: 1, is_active: true }],
    taxonomy_level3: [{ id: 175, level2_id: 2, slug: 'c', label_de: 'C', label_en: null, label_fr: null, label_it: null, sort_order: 1, is_active: true }],
    taxonomy_level4: [{ id: 324, level3_id: 175, slug: 'd', label_de: 'D', label_en: null, label_fr: null, label_it: null, sort_order: 1, is_active: true }],
    public_teacher_profiles: [
      { id: 'prov-a', city: 'Zürich', canton: 'Zürich', verification_status: 'pending' },
      { id: 'prov-b', city: 'Bern', canton: 'Bern', verification_status: null },
    ],
    ...overrides,
  };
}

describe('Lesequelle Produktion: nur öffentlicher Schlüssel', () => {
  it('erkennt öffentliche und Dienstschlüssel, ohne sie zu prüfen', () => {
    expect(classifySupabaseKey('sb_publishable_abc')).toBe('publishable');
    expect(classifySupabaseKey('sb_secret_abc')).toBe('secret');
    expect(classifySupabaseKey(jwt({ role: 'anon' }))).toBe('publishable');
    expect(classifySupabaseKey(jwt({ role: 'service_role' }))).toBe('secret');
    expect(classifySupabaseKey('')).toBe('missing');
    expect(classifySupabaseKey('irgendwas')).toBe('unknown');
  });

  it('lehnt Dienstschlüssel, fremde Adressen und das TEST-Projekt als Quelle ab', () => {
    const url = 'https://nplxmpfasgpumpiddjfl.supabase.co';
    expect(checkProdSource({ SUPABASE_URL_PROD_PUBLIC: url, SUPABASE_PUBLISHABLE_KEY_PROD: 'sb_publishable_x' })).toEqual({ ok: true, reason: null });
    expect(checkProdSource({ SUPABASE_URL_PROD_PUBLIC: url, SUPABASE_PUBLISHABLE_KEY_PROD: 'sb_secret_x' }).ok).toBe(false);
    expect(checkProdSource({ SUPABASE_URL_PROD_PUBLIC: url, SUPABASE_PUBLISHABLE_KEY_PROD: jwt({ role: 'service_role' }) }).ok).toBe(false);
    expect(checkProdSource({ SUPABASE_URL_PROD_PUBLIC: 'https://omoapbvfligjfznzivyu.supabase.co', SUPABASE_PUBLISHABLE_KEY_PROD: 'sb_publishable_x' }).ok).toBe(false);
    expect(checkProdSource({ SUPABASE_URL_PROD_PUBLIC: `${url}@evil.example`, SUPABASE_PUBLISHABLE_KEY_PROD: 'sb_publishable_x' }).ok).toBe(false);
  });
});

describe('Positivliste', () => {
  it('enthält keine gesperrten Felder; Profile nur Ort, Kanton, Verifizierung', () => {
    for (const fields of Object.values(EXPORT_FIELDS)) {
      for (const field of fields) expect(FORBIDDEN_FIELDS).not.toContain(field);
    }
    expect(EXPORT_FIELDS.public_teacher_profiles).toEqual(['id', 'city', 'canton', 'verification_status']);
    for (const field of ['contact_email', 'external_link', 'provider_url', 'plan_tier', 'ticket_limit_30d']) {
      expect(EXPORT_FIELDS.courses).not.toContain(field);
    }
  });

  it('deckt alle Kursfelder ab, die Suche und Index lesen', () => {
    const used = ['title', 'description', 'objectives', 'prerequisites', 'keywords', 'free_reason', 'level', 'languages',
      'language', 'delivery_types', 'delivery_type', 'target_age_groups', 'min_age', 'target_group', 'session_count',
      'session_length', 'price', 'price_info', 'booking_type', 'canton', 'image_url', 'instructor_name', 'kinder_kursart', 'user_id'];
    for (const field of used) expect(EXPORT_FIELDS.courses).toContain(field);
  });
});

describe('validateSnapshot', () => {
  it('akzeptiert einen gültigen öffentlichen Stand und zählt Anbieter', () => {
    const result = validateSnapshot(snapshot());
    expect(result.errors).toEqual([]);
    expect(result.counts).toMatchObject({ courses: 3, providers: 3, providersPublic: 2, maxCourseId: 9 });
  });

  it('lehnt gesperrte und nicht gelistete Felder ab', () => {
    const withEmail = snapshot();
    withEmail.courses[0].contact_email = 'x@example.org';
    expect(validateSnapshot(withEmail).errors.join(' ')).toMatch(/gesperrtes Feld contact_email/);
    const withBio = snapshot();
    withBio.public_teacher_profiles[0].bio_text = 'Text';
    expect(validateSnapshot(withBio).ok).toBe(false);
    const extra = snapshot();
    extra.course_events[0].internal_note = 'x';
    expect(validateSnapshot(extra).errors.join(' ')).toMatch(/nicht in der Positivliste/);
  });

  it('lehnt Entwürfe, zu grosse IDs, fremde Termine und unbekannte Kategorien ab', () => {
    const draft = snapshot();
    draft.courses[0].status = 'draft';
    expect(validateSnapshot(draft).errors.join(' ')).toMatch(/nur published/);
    const big = snapshot();
    big.courses[0].id = MAX_SOURCE_ID + 1;
    expect(validateSnapshot(big).ok).toBe(false);
    const orphan = snapshot();
    orphan.course_events[0].course_id = 999;
    expect(validateSnapshot(orphan).errors.join(' ')).toMatch(/nicht im Export/);
    const tax = snapshot();
    tax.course_category_assignments[0].level3_id = 1;
    expect(validateSnapshot(tax).errors.join(' ')).toMatch(/Stufe 3 1 unbekannt/);
    expect(validateSnapshot(snapshot({ courses: [] })).errors.join(' ')).toMatch(/keine veröffentlichten Kurse/);
  });
});

describe('buildImportRows', () => {
  const rows = buildImportRows(snapshot(), { secret: SECRET });

  it('verschiebt IDs in den Abnahmebereich und setzt Status und Prio fest', () => {
    expect(rows.courses.map((c) => c.id).sort()).toEqual([20003, 20007, 20009]);
    expect(rows.courses.every((c) => c.status === 'published' && c.is_prio === false)).toBe(true);
    expect(rows.courses.every((c) => inAcceptanceRange(c.id))).toBe(true);
    expect(rows.course_events[0].course_id).toBe(7 + ID_OFFSET);
    expect(rows.course_locations[0].course_id).toBe(3 + ID_OFFSET);
    expect(rows.course_category_assignments[0]).toMatchObject({ course_id: 20007, level3_id: 175, level4_id: 324 });
  });

  it('ersetzt Anbieter durch markierte Profile ohne Konto, Name oder Profiltext', () => {
    expect(rows.profiles.map((p) => p.full_name)).toEqual([`${PROVIDER_NAME_PREFIX}001`, `${PROVIDER_NAME_PREFIX}002`, `${PROVIDER_NAME_PREFIX}003`]);
    // Nummerierung nach kleinster Kurs-ID: prov-a (3), prov-b (7), prov-hidden (9).
    const byName = Object.fromEntries(rows.profiles.map((p) => [p.full_name, p]));
    expect(byName['E1-Anbieter 001']).toMatchObject({ role: 'teacher', city: 'Zürich', package_tier: 'basic', package_expires_at: null, email: null, slug: 'e1-anbieter-001' });
    // Nicht öffentlich sichtbarer Anbieter bleibt unsichtbar (keine Rolle teacher).
    expect(byName['E1-Anbieter 003']).toMatchObject({ role: 'student', city: null, canton: null });
    for (const profile of rows.profiles) {
      expect(Object.keys(profile).sort()).toEqual(['canton', 'city', 'email', 'full_name', 'id', 'package_expires_at', 'package_tier', 'role', 'slug', 'verification_status']);
      expect(profile.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(profile.id).not.toMatch(/prov-/);
    }
    const course7 = rows.courses.find((c) => c.id === 20007);
    expect(course7.user_id).toBe(byName['E1-Anbieter 002'].id);
  });

  it('enthält in keiner Zeile gesperrte Felder', () => {
    for (const [table, list] of Object.entries(rows)) {
      for (const row of list) {
        for (const key of Object.keys(row)) {
          if (table === 'profiles' && ['full_name', 'email', 'package_tier', 'package_expires_at'].includes(key)) continue; // fest gesetzte Platzhalter
          expect(FORBIDDEN_FIELDS, `${table}.${key}`).not.toContain(key);
        }
      }
    }
  });

  it('Pseudonyme sind je Lauf stabil, zwischen Läufen verschieden und brauchen einen Schlüssel', () => {
    expect(pseudonymUuid(SECRET, 'x')).toBe(pseudonymUuid(SECRET, 'x'));
    expect(pseudonymUuid(SECRET, 'x')).not.toBe(pseudonymUuid('b'.repeat(64), 'x'));
    expect(() => pseudonymUuid('kurz', 'x')).toThrow(/Pseudonym/);
  });
});

describe('diffTaxonomy', () => {
  it('findet fehlende Einträge und Abweichungen bei gleicher ID', () => {
    const source = snapshot();
    const target = Object.fromEntries(TAXONOMY_TABLES.map((t) => [t, []]));
    target.taxonomy_level1 = [...source.taxonomy_level1];
    target.taxonomy_level2 = [{ ...source.taxonomy_level2[0], label_de: 'anders' }];
    const diff = diffTaxonomy(source, target);
    expect(diff.missing.taxonomy_level1).toEqual([]);
    expect(diff.missing.taxonomy_level3.map((r) => r.id)).toEqual([175]);
    expect(diff.missing.taxonomy_level4.map((r) => r.id)).toEqual([324]);
    expect(diff.differing.taxonomy_level2).toEqual([2]);
  });
});

describe('Sicherung und Rückweg', () => {
  const chunks = [
    { id: 1, course_id: 10022, section: 'description', chunk_index: 0, text: 'Yoga am Abend', model_version: 'm@1024', embedding: '[0.1,0.2]' },
    { id: 2, course_id: 10022, section: 'keywords', chunk_index: 1, text: 'yoga', model_version: 'm@1024', embedding: '[0.3,0.4]' },
  ];
  const backup = sealBackup(buildBackup({
    courses: [{ id: 10022, status: 'published' }, { id: 5, status: 'draft' }],
    documents: [{ course_id: 10022, content_hash: 'h1' }],
    chunks,
    activeModelVersion: 'm@1024',
    createdAt: '2026-11-22T19:00:00Z',
  }));

  it('enthält Status, Prüfsummen und Embeddings, aber keine Kurstexte', () => {
    expect(backup.publishedCourseIds).toEqual([10022]);
    expect(backup.counts).toEqual({ publishedCourses: 1, documents: 1, chunks: 2, chunksEmbedded: 2 });
    expect(JSON.stringify(backup)).not.toMatch(/Yoga am Abend/);
    expect(backup.chunks[0]).toMatchObject({ key: '10022|description|0', text_md5: textMd5('Yoga am Abend'), embedding: '[0.1,0.2]' });
  });

  it('erkennt veränderte oder fremde Sicherungen', () => {
    expect(verifyBackup(backup)).toEqual({ ok: true, reason: null });
    expect(verifyBackup({ ...backup, publishedCourseIds: [1] }).ok).toBe(false);
    expect(verifyBackup({ ...backup, project: 'nplxmpfasgpumpiddjfl' }).ok).toBe(false);
  });

  it('vergleicht den wiederaufgebauten Index streng mit der Sicherung', () => {
    const rebuilt = chunks.map((c, i) => ({ ...c, id: 100 + i, embedding: null, model_version: null }));
    expect(compareIndexToBackup(backup, [{ course_id: 10022, content_hash: 'h1' }], rebuilt).ok).toBe(true);
    const wrong = compareIndexToBackup(backup, [{ course_id: 10022, content_hash: 'h2' }, { course_id: 20001, content_hash: 'x' }], rebuilt.slice(0, 1));
    expect(wrong.hashMismatch).toEqual([10022]);
    expect(wrong.extraDocs).toEqual([20001]);
    expect(wrong.missingChunks).toEqual(['10022|keywords|1']);
  });

  it('schreibt Embeddings nur bei gleichem Schlüssel und gleichem Text zurück', () => {
    const rebuilt = [
      { id: 100, course_id: 10022, section: 'description', chunk_index: 0, text: 'Yoga am Abend', model_version: null, embedding: null },
      { id: 101, course_id: 10022, section: 'keywords', chunk_index: 1, text: 'yoga, pilates', model_version: null, embedding: null },
    ];
    const plan = planEmbeddingRestore(backup, rebuilt);
    expect(plan.updates).toEqual([{ id: 100, embedding: '[0.1,0.2]', model_version: 'm@1024' }]);
    expect(plan.unmatched).toEqual(['10022|keywords|1']);
  });
});

describe('Ablaufsteuerung und Abbruchbedingungen', () => {
  const okState = { coursesInRange: 0, markedProfiles: 0, pendingJobs: 0, failedJobs: 0, activeOpsLease: false, chunksTotal: 10, chunksEmbedded: 10 };
  const okValidation = { ok: true, errors: [] };
  const okTaxonomy = { differing: Object.fromEntries(TAXONOMY_TABLES.map((t) => [t, []])) };

  it('liest Befehle streng; --execute nur für schreibende Befehle', () => {
    expect(parseArgs([])).toEqual({ command: 'plan', execute: false, errors: [] });
    expect(parseArgs(['switch', '--execute'])).toEqual({ command: 'switch', execute: true, errors: [] });
    expect(parseArgs(['plan', '--execute']).errors.join(' ')).toMatch(/gilt nur/);
    expect(parseArgs(['loeschen']).errors.join(' ')).toMatch(/unbekannter Befehl/);
    expect(parseArgs(['switch', '--force']).errors.join(' ')).toMatch(/unbekannte Optionen/);
  });

  it('schreibt nur mit --execute UND Bestätigung', () => {
    expect(checkWriteConfirm({ AI_ACCEPTANCE_CONFIRM: 'omoapbvfligjfznzivyu' }, false).ok).toBe(false);
    expect(checkWriteConfirm({}, true).ok).toBe(false);
    expect(checkWriteConfirm({ AI_ACCEPTANCE_CONFIRM: 'nplxmpfasgpumpiddjfl' }, true).ok).toBe(false);
    expect(checkWriteConfirm({ AI_ACCEPTANCE_CONFIRM: 'omoapbvfligjfznzivyu' }, true).ok).toBe(true);
  });

  it('Austausch bricht bei jeder verletzten Vorbedingung ab', () => {
    const base = { state: okState, validation: okValidation, taxonomy: okTaxonomy, backupState: 'none', indexCheck: { hashMismatch: 0, chunkFailures: 0 } };
    expect(switchPreconditions(base)).toEqual([]);
    const cases = [
      [{ state: { ...okState, coursesInRange: 1 } }, /Abnahmebereich/],
      [{ state: { ...okState, markedProfiles: 2 } }, /E1-Profile/],
      [{ state: { ...okState, pendingJobs: 3 } }, /offene Indexaufträge/],
      [{ state: { ...okState, failedJobs: 1 } }, /fehlgeschlagene/],
      [{ state: { ...okState, activeOpsLease: true } }, /Laufsperre/],
      [{ state: { ...okState, chunksEmbedded: 9 } }, /ohne Embedding/],
      [{ backupState: 'open' }, /offenen Rückweg/],
      [{ backupState: 'invalid' }, /ungültig/],
      [{ validation: { ok: false, errors: ['x'] } }, /ungültig/],
      [{ taxonomy: { differing: { ...okTaxonomy.differing, taxonomy_level3: [5] } } }, /Taxonomie/],
      [{ indexCheck: { hashMismatch: 2, chunkFailures: 0 } }, /aktuellen Code/],
    ];
    for (const [patch, pattern] of cases) {
      expect(switchPreconditions({ ...base, ...patch }).join(' ')).toMatch(pattern);
    }
  });

  it('Rückweg bricht ohne gültige Sicherung oder bei Buchungen auf Abnahmekursen ab', () => {
    const base = { state: okState, backupCheck: { ok: true }, importLog: { taxonomyAdded: {} }, references: { bookings: 0, leads: 0 } };
    expect(restorePreconditions(base)).toEqual([]);
    expect(restorePreconditions({ ...base, backupCheck: { ok: false, reason: 'Prüfsumme' } }).join(' ')).toMatch(/Prüfsumme/);
    expect(restorePreconditions({ ...base, importLog: null }).join(' ')).toMatch(/Importprotokoll/);
    expect(restorePreconditions({ ...base, references: { bookings: 1, leads: 0 } }).join(' ')).toMatch(/Buchungen/);
    expect(restorePreconditions({ ...base, state: { ...okState, pendingJobs: 1 } }).join(' ')).toMatch(/offene/);
  });
});

describe('Workflow und Logs (öffentliches Repository)', () => {
  const workflow = readFileSync('.github/workflows/ai-acceptance-test.yml', 'utf8');
  const step = (name) => {
    const start = workflow.indexOf(`- name: ${name}`);
    const next = workflow.indexOf('\n      - name:', start + 1);
    return workflow.slice(start, next === -1 ? undefined : next);
  };

  it('läuft nur über Labels, nie bei Push oder Zeitplan', () => {
    expect(workflow).toMatch(/on:\n\s+pull_request:\n\s+types: \[labeled\]/);
    expect(workflow).not.toMatch(/schedule:|push:/);
  });

  it('Trockenlauf ohne Bestätigung und ohne Modellschlüssel', () => {
    const dry = step('Trockenlauf');
    expect(dry).not.toMatch(/CONFIRM|OPENAI_API_KEY|--execute/);
  });

  it('feste Kostengrenzen: Einbettung 0.05, Qualitätslauf 0.50', () => {
    expect(step('Ersteinbettung')).toMatch(/--execute --max-usd=0\.05 --activate/);
    expect(step('Qualitaetslauf')).toMatch(/--execute --max-usd=0\.50/);
    expect(step('Austausch')).not.toMatch(/OPENAI_API_KEY/);
    expect(step('Rueckweg')).not.toMatch(/OPENAI_API_KEY/);
  });

  it('Produktion nur mit dem öffentlichen Schlüssel; kein Dienstschlüssel für Produktion', () => {
    expect(workflow).not.toMatch(/SECRET_KEY_PROD|SERVICE_ROLE/);
  });

  it('Skripte schreiben keine Titel, Texte oder Namen ins Log', () => {
    // Direkt eingesetzte Inhaltswerte (${x.title} usw.) sind verboten;
    // Zählungen wie countWords(x.explanation) sind erlaubt.
    const content = /\$\{[^}]*\.(title|explanation|description|instructor_name|full_name|query)\s*\}/;
    for (const file of ['scripts/ai-search-acceptance.mjs', 'scripts/ai-search-quality-run.mjs', 'scripts/ai-search-luna-probe.mjs']) {
      const source = readFileSync(file, 'utf8');
      const logLines = source.split('\n').filter((l) => /console\.(log|error)\(/.test(l));
      expect(logLines.length).toBeGreaterThan(0);
      for (const line of logLines) expect(line, line).not.toMatch(content);
    }
    expect(content.test('console.log(`${card.title}`)')).toBe(true);
    expect(content.test('console.log(`${countWords(card.explanation)} W.`)')).toBe(false);
  });
});

describe('Rückweg bei Änderungen von aussen (CI schreibt in dieselbe TESTumgebung)', () => {
  const backup = sealBackup(buildBackup({
    courses: [{ id: 93, status: 'published' }, { id: 10022, status: 'published' }],
    documents: [{ course_id: 93, content_hash: 'a' }, { course_id: 10022, content_hash: 'b' }],
    chunks: [
      { course_id: 93, section: 'description', chunk_index: 0, text: 'E2E', model_version: 'm', embedding: '[1]' },
      { course_id: 10022, section: 'description', chunk_index: 0, text: 'Yoga', model_version: 'm', embedding: '[2]' },
    ],
    activeModelVersion: 'm',
    createdAt: 't',
  }));

  it('merkt sich die höchste Kurs-ID zum Sicherungszeitpunkt', () => {
    expect(backup.maxCourseId).toBe(10022);
  });

  it('gelöschte und neue Fremdkurse werden ausgewiesen, nicht als Abweichung gezählt', () => {
    const docs = [{ course_id: 10022, content_hash: 'b' }, { course_id: 10950, content_hash: 'neu' }];
    const chunks = [
      { course_id: 10022, section: 'description', chunk_index: 0, text: 'Yoga' },
      { course_id: 10950, section: 'description', chunk_index: 0, text: 'E2E neu' },
    ];
    expect(compareIndexToBackup(backup, docs, chunks).ok).toBe(false);
    expect(compareIndexToBackup(backup, docs, chunks, { ignoreCourseIds: [93, 10950] }).ok).toBe(true);
    // Eine echte Abweichung bleibt trotz Ausnahmen sichtbar.
    const changed = compareIndexToBackup(backup, [{ course_id: 10022, content_hash: 'x' }], chunks, { ignoreCourseIds: [93, 10950] });
    expect(changed.hashMismatch).toEqual([10022]);
  });
});

describe('frühere Sicherung: archivieren statt blockieren, nur bei abgeschlossenem Rückweg', () => {
  const clean = { coursesInRange: 0, markedProfiles: 0 };
  it('abgeschlossener Rückweg erlaubt einen neuen Austausch (alte Sicherung wird archiviert)', () => {
    expect(switchPreconditions({ state: { ...clean, pendingJobs: 0, failedJobs: 0, activeOpsLease: false, chunksTotal: 1, chunksEmbedded: 1 }, validation: { ok: true, errors: [] }, taxonomy: { differing: {} }, backupState: 'closed', indexCheck: { hashMismatch: 0, chunkFailures: 0 } })).toEqual([]);
  });
  it('geschlossen nur, wenn alle gesicherten Kurse wieder veröffentlicht (oder gelöscht) und kein Abnahmebestand', () => {
    const ids = [1, 2, 3];
    expect(backupClosed({ state: clean, publishedIds: ids, currentRows: [{ id: 1, status: 'published' }, { id: 2, status: 'published' }, { id: 3, status: 'published' }] })).toBe(true);
    expect(backupClosed({ state: clean, publishedIds: ids, currentRows: [{ id: 1, status: 'published' }, { id: 2, status: 'published' }] })).toBe(true); // 3 seither gelöscht
    // Abbruch nach S4 (bisherige Kurse noch Entwurf): Rückweg offen → nie archivieren.
    expect(backupClosed({ state: clean, publishedIds: ids, currentRows: [{ id: 1, status: 'draft' }, { id: 2, status: 'draft' }, { id: 3, status: 'draft' }] })).toBe(false);
    expect(backupClosed({ state: { ...clean, coursesInRange: 5 }, publishedIds: ids, currentRows: ids.map((id) => ({ id, status: 'published' })) })).toBe(false);
  });
  it('Archivordner aus dem Sicherungszeitpunkt', () => {
    expect(archiveFolder('2026-11-22T19:37:50.165Z')).toBe('abnahme-katalog/archiv/2026-11-22T19-37-50-165Z');
  });
});
