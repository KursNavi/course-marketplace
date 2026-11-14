/**
 * Projektions-Builder (Worker-Kern S02): Publikationsregel, Feldabgrenzung,
 * deterministischer Versionshash und Löschanweisungen.
 */

import { describe, it, expect } from 'vitest';
import { buildProjection, contentHash } from '../src/lib/aiSearch/projection.js';

const publicCourse = (overrides = {}) => ({
  id: 42,
  status: 'published',
  title: 'Yoga für Anfänger',
  description: 'Sanfter Einstieg in Zürich.',
  objectives: 'Beweglichkeit verbessern.',
  booking_type: 'lead',
  price: 0,
  language: 'DE',
  canton: 'ZH',
  contact_email: 'privat@anbieter.ch',
  basic_lead_ranking_factor: 0.8,
  is_prio: true,
  course_locations: [{ city: 'Zürich', canton: 'ZH', location_type: 'presence' }],
  ...overrides,
});

describe('buildProjection – Publikationsregel', () => {
  it('veröffentlichter Kurs ergibt upsert mit Dokument und Chunks', () => {
    const result = buildProjection(publicCourse(), {}, { sourceVersion: 7 });
    expect(result.action).toBe('upsert');
    expect(result.document.course_id).toBe(42);
    expect(result.document.source_version).toBe(7);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('Entwurf und Legacy-NULL ergeben delete (nichts gelangt in den Index)', () => {
    expect(buildProjection(publicCourse({ status: 'draft' }))).toMatchObject({ action: 'delete', reason: 'not_public' });
    expect(buildProjection(publicCourse({ status: null }))).toMatchObject({ action: 'delete', reason: 'not_public' });
  });

  it('fehlende Quellzeile ergibt delete (Rücknahme-Vorrang)', () => {
    expect(buildProjection(null)).toMatchObject({ action: 'delete', reason: 'missing_source' });
  });
});

describe('buildProjection – Feldabgrenzung', () => {
  it('contact_email, Lead- und Paketfelder erscheinen weder im Dokument noch in Chunks', () => {
    const result = buildProjection(publicCourse(), {
      profile: {
        slug: 'studio-zh', city: 'Zürich', canton: 'ZH', verification_status: 'verified',
        bio_text: 'Seit 2010.', email: 'geheim@anbieter.ch', stripe_account_id: 'acct_123',
      },
    }, { sourceVersion: 1 });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('privat@anbieter.ch');
    expect(serialized).not.toContain('geheim@anbieter.ch');
    expect(serialized).not.toContain('acct_123');
    expect(serialized).not.toContain('basic_lead_ranking_factor');
    expect(serialized).not.toContain('is_prio');
    expect(result.document.facts.provider.slug).toBe('studio-zh');
  });

  it('Preisstatus folgt der booking_type-Semantik (lead+0 → unknown)', () => {
    const result = buildProjection(publicCourse(), {}, { sourceVersion: 1 });
    expect(result.document.price_status).toBe('unknown');
    expect(result.document.price_amount).toBeNull();
  });
});

describe('contentHash / Idempotenz', () => {
  it('gleicher Inhalt ergibt denselben Hash, geänderter Inhalt einen anderen', () => {
    const a = buildProjection(publicCourse(), {}, { sourceVersion: 1 });
    const b = buildProjection(publicCourse(), {}, { sourceVersion: 2 });
    const c = buildProjection(publicCourse({ description: 'Neuer Text.' }), {}, { sourceVersion: 3 });
    // source_version ändert den Inhaltshash nicht (No-op-Erkennung):
    expect(a.document.content_hash).toBe(b.document.content_hash);
    expect(a.document.content_hash).not.toBe(c.document.content_hash);
  });

  it('contentHash ist deterministisch und formatstabil', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
    expect(contentHash({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
});
