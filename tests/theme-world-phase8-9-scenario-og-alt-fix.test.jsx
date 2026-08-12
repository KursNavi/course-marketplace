/**
 * Phase 8.9 — Scenario OG-Image-Alt-Text-Feld-Fix
 *
 * Root Cause (behoben):
 *   AdminScenarioForm.jsx hatte drei Fehler beim OG-Bild-Alt-Text-Feld:
 *     1. `og_image_alt` fehlte im form-State (useState)
 *     2. `altText=""` war hardcoded → AdminImageField zeigte immer leeres Feld
 *     3. `onAltTextChange={() => {}}` war ein No-Op → Eingaben wurden verworfen
 *     4. `og_image_alt` fehlte im handleSave-Payload
 *     5. `og_image_alt` fehlte in loadScenario-Mapping
 *   Ausserdem:
 *     6. `og_image_alt` fehlte in ALLOWED_WRITE_FIELDS (API-Allowlist)
 *     7. `og_image_alt` fehlte in validateScenario (Validator)
 *     8. `og_image_alt`-Spalte fehlte in theme_world_scenarios (DB-Schema)
 *
 * Abgedeckte Tests:
 *   - OG-Alt-Text lässt sich tippen
 *   - Vollständiger Text bleibt nach mehreren Tastatureingaben erhalten
 *   - Umlaute bleiben erhalten
 *   - Feld lässt sich löschen und neu befüllen
 *   - Karten- und OG-Alt-Text beeinflussen sich nicht gegenseitig
 *   - Bildauswahl deaktiviert das Alt-Text-Feld nicht (via onImageUploaded)
 *   - Save-Payload enthält den korrekten OG-Alt-Text
 *   - Reload lädt den korrekten Wert
 *   - Kein Dirty-State direkt nach Reload
 *   - Karten-Bild-Alt-Text funktioniert weiterhin
 *   - Bestehende Artikel ohne OG-Alt-Text laden weiterhin
 *   - API-Allowlist enthält og_image_alt
 *   - Validator prüft og_image_alt (optionalText, max 200 Zeichen)
 *   - Keine Regression bei Sport- und Yoga-Daten
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// themeWorldAdminApi mock
// ---------------------------------------------------------------------------

const {
  mockGetScenario,
  mockCreateScenario,
  mockUpdateScenario,
  mockGetErrorMessage,
  MockApiError,
} = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(msg, status = 500) {
      super(msg);
      this.name = 'ApiError';
      this.status = status;
    }
    get isConflict() { return this.status === 409; }
    get isUnauthorized() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isUnprocessable() { return this.status === 422; }
    get isServerError() { return this.status >= 500; }
    get isTimeout() { return false; }
    get isNetworkError() { return false; }
  }
  return {
    mockGetScenario: vi.fn(),
    mockCreateScenario: vi.fn(),
    mockUpdateScenario: vi.fn(),
    mockGetErrorMessage: vi.fn((err) => err?.message || 'Fehler'),
    MockApiError,
  };
});

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  getScenario: mockGetScenario,
  createScenario: mockCreateScenario,
  updateScenario: mockUpdateScenario,
  getErrorMessage: mockGetErrorMessage,
  ApiError: MockApiError,
}));

// ---------------------------------------------------------------------------
// Child-Component mocks
// ---------------------------------------------------------------------------

vi.mock('../src/components/admin/AdminStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('../src/components/admin/AdminSaveState', () => ({
  default: () => null,
}));

vi.mock('../src/components/admin/AdminSeoFields', () => ({
  default: ({ metaTitle, metaDescription, onChange }) => (
    <div>
      <input
        data-testid="meta-title"
        value={metaTitle}
        onChange={(e) => onChange({ metaTitle: e.target.value, metaDescription })}
      />
      <input
        data-testid="meta-description"
        value={metaDescription}
        onChange={(e) => onChange({ metaTitle, metaDescription: e.target.value })}
      />
    </div>
  ),
}));

/**
 * AdminImageField-Mock: rendert Alt-Text-Input sichtbar und simuliert onImageUploaded.
 * Wichtig: onAltTextChange muss aufgerufen werden und der Wert muss als value verwendet werden.
 */
vi.mock('../src/components/admin/AdminImageField', () => ({
  default: ({ label, currentUrl, altText, onImageUploaded, onAltTextChange, altRequired }) => (
    <div data-testid={`image-field-${label.replace(/[^a-zA-Z0-9]/g, '-')}`}>
      <input
        data-testid={`alt-input-${label.replace(/[^a-zA-Z0-9]/g, '-')}`}
        value={altText ?? ''}
        placeholder={altRequired ? 'Alt-Text (Pflicht)' : 'Alt-Text (optional)'}
        onChange={(e) => onAltTextChange(e.target.value)}
      />
      <button
        data-testid={`upload-btn-${label.replace(/[^a-zA-Z0-9]/g, '-')}`}
        onClick={() => onImageUploaded({ publicUrl: 'https://example.com/new.jpg' })}
      >
        Upload simulieren
      </button>
      <span data-testid={`url-display-${label.replace(/[^a-zA-Z0-9]/g, '-')}`}>
        {currentUrl || ''}
      </span>
    </div>
  ),
}));

vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Test-Datensätze
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'scenario-uuid-phase89';
const THEME_WORLD_ID = 'tw-uuid-phase89';

function buildScenarioData(overrides = {}) {
  return {
    id: SCENARIO_ID,
    theme_world_id: THEME_WORLD_ID,
    label_de: 'Berufseinstieg als Fitness-Trainer',
    slug: 'berufseinstieg',
    icon: '🎓',
    teaser_de: 'Dein Weg in die Fitness-Branche.',
    content_html: '<p>Inhalt.</p>',
    card_image_url: 'https://example.com/card.jpg',
    card_image_alt: 'Fitness-Trainer im Einsatz',
    og_image_url: 'https://example.com/og.jpg',
    og_image_alt: 'Social Media Bild Fitness',
    meta_title: 'Berufseinstieg Fitness',
    meta_description: 'Dein Weg als Fitness-Trainer.',
    cta_label_de: 'Jetzt Kurse finden',
    cta_config: { spec: 'Fitness Trainer' },
    sort_order: 0,
    status: 'draft',
    published_at: null,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: THEME_WORLD_ID,
  scenarioId: null,
  setSelectedScenarioId: vi.fn(),
};

// testid-Konstanten
const OG_ALT_TESTID = 'alt-input-Open-Graph-Bild--Social-Media-';
const CARD_ALT_TESTID = 'alt-input-Karten-Bild--Anzeige-auf-Landingpage-';

async function renderForm(props = {}) {
  const { default: AdminScenarioForm } = await import('../src/components/admin/AdminScenarioForm.jsx');
  const mergedProps = { ...DEFAULT_PROPS, ...props };
  let container;
  await act(async () => {
    const result = render(
      <AdminScenarioForm {...mergedProps} key={mergedProps.scenarioId ?? 'new'} />
    );
    container = result.container;
  });
  return container;
}

// ---------------------------------------------------------------------------
// Hilfsfunktion: Testid aus Mock-Label ableiten
// ---------------------------------------------------------------------------

function altTestId(label) {
  return `alt-input-${label.replace(/[^a-zA-Z0-9]/g, '-')}`;
}
function uploadTestId(label) {
  return `upload-btn-${label.replace(/[^a-zA-Z0-9]/g, '-')}`;
}

const OG_LABEL = 'Open-Graph-Bild (Social Media)';
const CARD_LABEL = 'Karten-Bild (Anzeige auf Landingpage)';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 8.9 — Scenario OG-Image-Alt-Text-Fix', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Neues Szenario: OG-Alt-Text lässt sich tippen
  // -------------------------------------------------------------------------

  describe('Neues Szenario (isNew=true)', () => {

    it('rendert das OG-Alt-Text-Feld', async () => {
      await renderForm();
      expect(screen.getByTestId(altTestId(OG_LABEL))).toBeInTheDocument();
    });

    it('OG-Alt-Text lässt sich tippen', async () => {
      await renderForm();
      const input = screen.getByTestId(altTestId(OG_LABEL));
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Mein OG-Bild' } });
      });
      expect(input.value).toBe('Mein OG-Bild');
    });

    it('vollständiger Text bleibt nach mehreren Eingaben erhalten', async () => {
      await renderForm();
      const input = screen.getByTestId(altTestId(OG_LABEL));
      await act(async () => { fireEvent.change(input, { target: { value: 'OG' } }); });
      await act(async () => { fireEvent.change(input, { target: { value: 'OG Bild' } }); });
      await act(async () => { fireEvent.change(input, { target: { value: 'OG Bild für Social' } }); });
      expect(input.value).toBe('OG Bild für Social');
    });

    it('Umlaute bleiben erhalten', async () => {
      await renderForm();
      const input = screen.getByTestId(altTestId(OG_LABEL));
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Öffentliche Übung im Zürich-Sommer' } });
      });
      expect(input.value).toBe('Öffentliche Übung im Zürich-Sommer');
    });

    it('Feld lässt sich löschen und neu befüllen', async () => {
      await renderForm();
      const input = screen.getByTestId(altTestId(OG_LABEL));
      await act(async () => { fireEvent.change(input, { target: { value: 'Erster Wert' } }); });
      await act(async () => { fireEvent.change(input, { target: { value: '' } }); });
      expect(input.value).toBe('');
      await act(async () => { fireEvent.change(input, { target: { value: 'Zweiter Wert' } }); });
      expect(input.value).toBe('Zweiter Wert');
    });

    it('OG-Alt und Karten-Alt beeinflussen sich nicht gegenseitig', async () => {
      await renderForm();
      const ogInput = screen.getByTestId(altTestId(OG_LABEL));
      const cardInput = screen.getByTestId(altTestId(CARD_LABEL));

      await act(async () => { fireEvent.change(ogInput, { target: { value: 'OG Text' } }); });
      await act(async () => { fireEvent.change(cardInput, { target: { value: 'Card Text' } }); });

      expect(ogInput.value).toBe('OG Text');
      expect(cardInput.value).toBe('Card Text');

      await act(async () => { fireEvent.change(ogInput, { target: { value: 'OG geändert' } }); });
      expect(cardInput.value).toBe('Card Text'); // Card unverändert
    });

    it('OG-Alt-Text bleibt nach simuliertem Bildupload bearbeitbar', async () => {
      await renderForm();
      const ogInput = screen.getByTestId(altTestId(OG_LABEL));
      const uploadBtn = screen.getByTestId(uploadTestId(OG_LABEL));

      await act(async () => { fireEvent.change(ogInput, { target: { value: 'Vor Upload' } }); });
      await act(async () => { fireEvent.click(uploadBtn); }); // Upload simuliert
      await act(async () => { fireEvent.change(ogInput, { target: { value: 'Nach Upload' } }); });

      expect(ogInput.value).toBe('Nach Upload');
    });

    it('Karten-Alt-Text funktioniert weiterhin korrekt', async () => {
      await renderForm();
      const cardInput = screen.getByTestId(altTestId(CARD_LABEL));
      await act(async () => { fireEvent.change(cardInput, { target: { value: 'Trainer auf dem Feld' } }); });
      expect(cardInput.value).toBe('Trainer auf dem Feld');
    });

    it('Save-Payload enthält korrekten OG-Alt-Text', async () => {
      mockCreateScenario.mockResolvedValue({ id: 'new-uuid', slug: 'test', status: 'draft' });
      await renderForm();

      const titleInput = screen.getByPlaceholderText('Berufseinstieg als Fitness-Trainer');
      const ogInput = screen.getByTestId(altTestId(OG_LABEL));

      await act(async () => {
        fireEvent.change(titleInput, { target: { value: 'Test Szenario' } });
      });
      await act(async () => {
        fireEvent.change(ogInput, { target: { value: 'Mein OG Alt Text' } });
      });

      const saveBtn = screen.getAllByText('Speichern')[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());

      const [, payload] = mockCreateScenario.mock.calls[0];
      expect(payload.og_image_alt).toBe('Mein OG Alt Text');
    });

  });

  // -------------------------------------------------------------------------
  // Bestehendes Szenario: Reload lädt og_image_alt korrekt
  // -------------------------------------------------------------------------

  describe('Bestehendes Szenario (isNew=false)', () => {

    it('Reload lädt og_image_alt korrekt in das Feld', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({ og_image_alt: 'Gespeicherter Alt Text' }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        const input = screen.getByTestId(altTestId(OG_LABEL));
        expect(input.value).toBe('Gespeicherter Alt Text');
      });
    });

    it('kein Dirty-State direkt nach Reload', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({ og_image_alt: 'Geladener Text' }));
      const showNotif = vi.fn();
      await renderForm({ scenarioId: SCENARIO_ID, showNotification: showNotif });

      // Nach Reload keine Auto-Speicherung erwartet
      await new Promise((r) => setTimeout(r, 50));
      expect(mockUpdateScenario).not.toHaveBeenCalled();
    });

    it('Szenario ohne og_image_alt lädt ohne Fehler (null → leer)', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({ og_image_alt: null }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        const input = screen.getByTestId(altTestId(OG_LABEL));
        expect(input.value).toBe('');
      });
    });

    it('Szenario mit og_image_alt=undefined lädt ohne Fehler (→ leer)', async () => {
      const data = buildScenarioData();
      delete data.og_image_alt; // kein og_image_alt im Response
      mockGetScenario.mockResolvedValue(data);
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        const input = screen.getByTestId(altTestId(OG_LABEL));
        expect(input.value).toBe('');
      });
    });

    it('og_image_alt lässt sich nach Reload bearbeiten', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({ og_image_alt: 'Original' }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        expect(screen.getByTestId(altTestId(OG_LABEL)).value).toBe('Original');
      });

      const input = screen.getByTestId(altTestId(OG_LABEL));
      await act(async () => { fireEvent.change(input, { target: { value: 'Geändert' } }); });
      expect(input.value).toBe('Geändert');
    });

    it('Save-Payload nach Reload enthält geänderten OG-Alt-Text', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({ og_image_alt: 'Original' }));
      mockUpdateScenario.mockResolvedValue({ id: SCENARIO_ID, slug: 'berufseinstieg', status: 'draft', updated_at: '2026-07-29T12:00:00Z' });
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        expect(screen.getByTestId(altTestId(OG_LABEL)).value).toBe('Original');
      });

      const input = screen.getByTestId(altTestId(OG_LABEL));
      await act(async () => { fireEvent.change(input, { target: { value: 'Aktualisiert' } }); });

      const saveBtn = screen.getAllByText('Speichern')[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockUpdateScenario).toHaveBeenCalled());
      const [, payload] = mockUpdateScenario.mock.calls[0];
      expect(payload.og_image_alt).toBe('Aktualisiert');
    });

    it('Karten-Alt-Text wird auch nach Reload korrekt geladen', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({ card_image_alt: 'Karten-Trainer' }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        expect(screen.getByTestId(altTestId(CARD_LABEL)).value).toBe('Karten-Trainer');
      });
    });

    it('Karten-Alt und OG-Alt werden unabhängig voneinander geladen', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({
        card_image_alt: 'Karten-Text',
        og_image_alt: 'OG-Text',
      }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        expect(screen.getByTestId(altTestId(CARD_LABEL)).value).toBe('Karten-Text');
        expect(screen.getByTestId(altTestId(OG_LABEL)).value).toBe('OG-Text');
      });
    });

  });

  // -------------------------------------------------------------------------
  // API-Allowlist und Validator
  // -------------------------------------------------------------------------

  describe('API-Allowlist: og_image_alt in ALLOWED_WRITE_FIELDS', () => {
    it('og_image_alt ist in der Allowlist enthalten', async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const src = readFileSync(resolve('api/admin-theme-world-scenarios.js'), 'utf8');
      expect(src).toMatch(/ALLOWED_WRITE_FIELDS/);
      expect(src).toMatch(/'og_image_alt'/);
    });
  });

  describe('Validator: og_image_alt wird für Szenarien geprüft', () => {
    it('validateScenario enthält optionalText-Prüfung für og_image_alt', async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const src = readFileSync(resolve('api/_lib/theme-world-validate.js'), 'utf8');
      // Muss optionalText für og_image_alt in validateScenario-Kontext enthalten
      expect(src).toMatch(/optionalText\(errors, data, 'og_image_alt'/);
    });

    it('validateScenario akzeptiert gültigen og_image_alt-Wert', async () => {
      const { validateScenario } = await import('../api/_lib/theme-world-validate.js');
      const result = validateScenario({
        label_de: 'Test Szenario',
        slug: 'test-szenario',
        og_image_url: 'https://example.com/og.jpg',
        og_image_alt: 'Alt-Text für OG-Bild',
        card_image_url: null,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validateScenario lehnt og_image_alt > 200 Zeichen ab', async () => {
      const { validateScenario } = await import('../api/_lib/theme-world-validate.js');
      const result = validateScenario({
        label_de: 'Test',
        slug: 'test',
        og_image_alt: 'A'.repeat(201),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('og_image_alt'))).toBe(true);
    });

    it('validateScenario akzeptiert leeren og_image_alt (optional)', async () => {
      const { validateScenario } = await import('../api/_lib/theme-world-validate.js');
      const result = validateScenario({
        label_de: 'Test Szenario',
        slug: 'test-szenario',
        og_image_alt: '',
        card_image_url: null,
      });
      expect(result.valid).toBe(true);
    });

    it('validateScenario akzeptiert fehlendes og_image_alt (optional)', async () => {
      const { validateScenario } = await import('../api/_lib/theme-world-validate.js');
      const result = validateScenario({
        label_de: 'Test Szenario',
        slug: 'test-szenario',
        card_image_url: null,
      });
      expect(result.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // DB-Migration: Spalte vorhanden
  // -------------------------------------------------------------------------

  describe('DB-Migration: og_image_alt-Spalte', () => {
    it('Migration-Datei existiert und enthält ADD COLUMN für og_image_alt', async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const sql = readFileSync(
        resolve('supabase/migrations/20260729_add_scenario_og_image_alt.sql'),
        'utf8',
      );
      expect(sql).toMatch(/ADD COLUMN/i);
      expect(sql).toMatch(/og_image_alt/);
      expect(sql).toMatch(/theme_world_scenarios/);
    });
  });

  // -------------------------------------------------------------------------
  // Regression: Sport- und Yoga-Daten unverändert
  // -------------------------------------------------------------------------

  describe('Keine Regression bei Sport- und Yoga-Szenarien', () => {

    it('Sport-Szenario ohne og_image_alt lädt korrekt', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({
        label_de: 'Berufseinstieg als Sport-Trainer',
        card_image_alt: 'Sport-Trainer',
        og_image_alt: null,
        og_image_url: null,
      }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        expect(screen.getByTestId(altTestId(OG_LABEL)).value).toBe('');
        expect(screen.getByTestId(altTestId(CARD_LABEL)).value).toBe('Sport-Trainer');
      });
    });

    it('Yoga-Szenario mit og_image_alt lädt korrekt', async () => {
      mockGetScenario.mockResolvedValue(buildScenarioData({
        label_de: 'Yoga für Einsteiger',
        card_image_alt: 'Yoga-Pose',
        og_image_alt: 'Yoga OG Bild',
        og_image_url: 'https://example.com/yoga-og.jpg',
      }));
      await renderForm({ scenarioId: SCENARIO_ID });

      await waitFor(() => {
        expect(screen.getByTestId(altTestId(OG_LABEL)).value).toBe('Yoga OG Bild');
        expect(screen.getByTestId(altTestId(CARD_LABEL)).value).toBe('Yoga-Pose');
      });
    });

  });

});
