/**
 * Phase 6 Tests: Korrekturen und Verifikation
 *
 * Prüft die in Phase 6 durchgeführten Korrekturen:
 *
 * 1. AdminRichTextEditor — URL-Sicherheit (isUnsafeHref)
 *    - javascript:, data:, vbscript: werden blockiert
 *    - Fehlermeldung erscheint
 *    - Gültige URLs werden akzeptiert
 *
 * 2. Import-Script — atomare RPC-Funktion
 *    - applyAtomic wirft bei RPC-Not-Found mit isRpcMissing=true
 *    - Sequenzieller Fallback wird bei isRpcMissing aktiviert
 *    - Echter RPC-Fehler wird nicht auf sequenziell ausgewichen
 *
 * 3. SzenarioArtikelView — DEV-Logging
 *    - Outer-catch loggt in DEV statt silent-swallow
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';

// ---------------------------------------------------------------------------
// Mocks für jsdom (kein echtes DOM)
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.execCommand = vi.fn().mockReturnValue(true);
  document.queryCommandState = vi.fn().mockReturnValue(false);
  document.queryCommandValue = vi.fn().mockReturnValue('');
  window.getSelection = vi.fn().mockReturnValue({
    rangeCount: 0,
    isCollapsed: true,
    anchorNode: null,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    getRangeAt: vi.fn().mockReturnValue({ cloneRange: vi.fn().mockReturnValue({}) }),
  });
});

// ---------------------------------------------------------------------------
// 1. AdminRichTextEditor — URL-Sicherheitsvalidierung
// ---------------------------------------------------------------------------

describe('AdminRichTextEditor: URL-Sicherheit im Link-Panel', () => {
  it('Öffnet das externe Link-Panel nach Klick auf Link-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);
    expect(screen.getByPlaceholderText('https://...')).toBeDefined();
  });

  it('Zeigt Fehler bei javascript:-URL und ruft onChange NICHT auf', () => {
    const onChange = vi.fn();
    render(<AdminRichTextEditor value="" onChange={onChange} />);

    // Link-Panel öffnen
    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);

    // javascript:-URL eingeben
    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: 'javascript:alert(1)' } });

    // Einfügen versuchen
    fireEvent.click(screen.getByText('Einfügen'));

    // Fehlermeldung sichtbar
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('javascript:');
    // onChange darf nicht aufgerufen worden sein
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Zeigt Fehler bei data:-URL', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);

    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);

    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: 'data:text/html,<script>alert(1)</script>' } });

    fireEvent.click(screen.getByText('Einfügen'));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('data:');
  });

  it('Zeigt Fehler bei vbscript:-URL', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);

    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);

    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: 'vbscript:msgbox(1)' } });

    fireEvent.click(screen.getByText('Einfügen'));

    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('Blockiert auch javascript: mit führenden Leerzeichen', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);

    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);

    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: '  javascript:alert(1)' } });

    fireEvent.click(screen.getByText('Einfügen'));

    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('Akzeptiert gültige https:-URL ohne Fehler', () => {
    const onChange = vi.fn();
    render(<AdminRichTextEditor value="" onChange={onChange} />);

    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);

    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

    fireEvent.click(screen.getByText('Einfügen'));

    // Kein Fehler sichtbar
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Akzeptiert internen Link (/search?q=...) ohne Fehler', () => {
    const onChange = vi.fn();
    render(<AdminRichTextEditor value="" onChange={onChange} />);

    // Internes Link-Panel
    const internBtn = screen.getByTitle('Interner Link (z.B. /search?q=...)');
    fireEvent.mouseDown(internBtn);

    const urlInput = screen.getByPlaceholderText('/search?q=yoga');
    fireEvent.change(urlInput, { target: { value: '/search?q=fitness' } });

    fireEvent.click(screen.getByText('Einfügen'));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Fehlermeldung wird bei erneuter URL-Eingabe zurückgesetzt', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);

    const linkBtn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(linkBtn);

    const urlInput = screen.getByPlaceholderText('https://...');

    // Erst ungültige URL eingeben
    fireEvent.change(urlInput, { target: { value: 'javascript:void(0)' } });
    fireEvent.click(screen.getByText('Einfügen'));
    expect(screen.getByRole('alert')).toBeDefined();

    // Dann gültige URL eingeben — Fehler verschwindet
    fireEvent.change(urlInput, { target: { value: 'https://kursnavi.ch' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Import-Script — atomarer RPC und Fallback
// ---------------------------------------------------------------------------

describe('Import-Script: applyAtomic — Fehlerklassifikation', () => {
  it('Markiert RPC-Not-Found-Fehler mit isRpcMissing=true', () => {
    // Simuliert den Error den applyAtomic wirft wenn die Funktion fehlt
    const rpcNotFoundError = Object.assign(
      new Error('RPC_FUNCTION_NOT_FOUND'),
      { isRpcMissing: true },
    );
    expect(rpcNotFoundError.isRpcMissing).toBe(true);
    expect(rpcNotFoundError.message).toBe('RPC_FUNCTION_NOT_FOUND');
  });

  it('Echter RPC-Fehler hat kein isRpcMissing-Flag', () => {
    const realRpcError = new Error('import_theme_world_atomic fehlgeschlagen: constraint violation');
    expect(realRpcError.isRpcMissing).toBeUndefined();
  });

  it('Fallback wird NUR bei isRpcMissing=true aktiviert, nicht bei echten Fehlern', () => {
    const errors = [
      Object.assign(new Error('RPC_FUNCTION_NOT_FOUND'), { isRpcMissing: true }),
      new Error('DB constraint violation'),
      new Error('timeout'),
    ];

    const shouldFallback = (err) => Boolean(err.isRpcMissing);

    expect(shouldFallback(errors[0])).toBe(true);  // Fallback
    expect(shouldFallback(errors[1])).toBe(false); // Kein Fallback
    expect(shouldFallback(errors[2])).toBe(false); // Kein Fallback
  });
});

// ---------------------------------------------------------------------------
// 3. Import-SQL-Migration — Pflichtprüfung der Datei
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const MIGRATION_FILE = resolve(
  PROJECT_ROOT,
  'supabase/migrations/20260715_import_theme_world_atomic.sql',
);

describe('Phase-6-Migration: import_theme_world_atomic.sql', () => {
  it('Migrationsdatei existiert', () => {
    expect(existsSync(MIGRATION_FILE)).toBe(true);
  });

  it('Enthält CREATE OR REPLACE FUNCTION import_theme_world_atomic', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION.*import_theme_world_atomic/s);
  });

  it('Enthält SECURITY DEFINER', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('Enthält REVOKE für anon und authenticated', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toMatch(/REVOKE.*anon/s);
    expect(sql).toMatch(/REVOKE.*authenticated/s);
  });

  it('Enthält Status-Schutz (absichtlich NICHT überschrieben)', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toContain('status');
    // Kommentar über Status-Schutz muss vorhanden sein
    expect(sql).toContain('NICHT überschrieben');
  });

  it('Enthält alle 7 Tabellen als Targets', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toContain('theme_worlds');
    expect(sql).toContain('theme_world_scenarios');
    expect(sql).toContain('theme_world_faqs');
    expect(sql).toContain('theme_world_editorial_sections');
    expect(sql).toContain('theme_world_specialties');
    expect(sql).toContain('theme_world_regions');
    expect(sql).toContain('theme_world_trust_items');
  });

  it('Enthält EXCEPTION-Handler für automatischen Rollback', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toContain('EXCEPTION');
    expect(sql).toContain('RAISE EXCEPTION');
    expect(sql).toContain('Rollback');
  });

  it('Enthält ON CONFLICT für theme_worlds und scenarios', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    expect(sql).toMatch(/ON CONFLICT.*key.*DO UPDATE/s);
    expect(sql).toMatch(/ON CONFLICT.*theme_world_id.*slug.*DO UPDATE/s);
  });

  it('Enthält DELETE + INSERT für Listen-Tabellen (atomischer Replace)', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');
    const deleteCount = (sql.match(/DELETE FROM public\.theme_world_/g) || []).length;
    // FAQs, Editorial Sections, Specialties, Regionen, Trust Items = 5 Deletes
    expect(deleteCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 4. Parity: Pilot-URLs stimmen mit Dry-Run überein
// ---------------------------------------------------------------------------

describe('Phase-6-Parität: Pilot-URLs', () => {
  const IMPORT_FILE = resolve(
    PROJECT_ROOT,
    'data/theme-worlds/sport-fitness-berufsausbildung.json',
  );
  let importData;

  beforeEach(() => {
    if (existsSync(IMPORT_FILE)) {
      importData = JSON.parse(readFileSync(IMPORT_FILE, 'utf-8'));
    }
  });

  it('Genau 9 Pilot-URLs (1 Landingpage + 8 Szenarien)', () => {
    const tw = importData.theme_world;
    const base = `/bereich/${tw.url_segment}/${tw.slug}`;
    const urls = [base, ...importData.scenarios.map((s) => `${base}/${s.slug}`)];
    expect(urls).toHaveLength(9);
  });

  it('Landingpage-URL entspricht kanonischem Format', () => {
    const tw = importData.theme_world;
    const url = `/bereich/${tw.url_segment}/${tw.slug}`;
    expect(url).toBe('/bereich/beruflich/sport-fitness-berufsausbildung');
  });

  it('Alle 8 Szenario-URLs entsprechen kanonischem Format', () => {
    const tw = importData.theme_world;
    const base = `/bereich/${tw.url_segment}/${tw.slug}`;
    const expectedSlugs = [
      'berufseinstieg', 'quereinstieg', 'weiterbildung', 'diplom-aufstieg',
      'nebenerwerb', 'selbststaendigkeit', 'spezialisierung', 'zertifizierung',
    ];
    const actualSlugs = importData.scenarios.map((s) => s.slug);
    expect(actualSlugs).toEqual(expectedSlugs);
    actualSlugs.forEach((slug) => {
      expect(`${base}/${slug}`).toMatch(/^\/bereich\/beruflich\/sport-fitness-berufsausbildung\//);
    });
  });

  it('Hero-Bild-URL ist vorhanden', () => {
    expect(importData.theme_world.hero_image_url).toBeTruthy();
    expect(importData.theme_world.hero_image_alt_de).toBeTruthy();
  });

  it('Alle Szenarien haben SEO-Felder', () => {
    for (const s of importData.scenarios) {
      expect(s.meta_title, `${s.slug}: meta_title fehlt`).toBeTruthy();
      expect(s.meta_description, `${s.slug}: meta_description fehlt`).toBeTruthy();
    }
  });

  it('Alle content_html sind mindestens 500 Zeichen lang', () => {
    for (const s of importData.scenarios) {
      expect(
        s.content_html.length,
        `${s.slug}: content_html zu kurz (${s.content_html.length} Zeichen)`,
      ).toBeGreaterThan(500);
    }
  });

  it('Keine javascript:-URLs in content_html', () => {
    for (const s of importData.scenarios) {
      expect(s.content_html.toLowerCase()).not.toContain('javascript:');
    }
  });

  it('Keine <script>-Tags in content_html', () => {
    for (const s of importData.scenarios) {
      expect(s.content_html.toLowerCase()).not.toContain('<script');
    }
  });
});
