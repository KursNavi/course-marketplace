/**
 * Unit-Tests für den Theme-World-HTML-Sanitizer.
 * Prüft Entfernung gefährlicher HTML-Konstrukte.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, containsDangerousHtml } from '../api/_lib/theme-world-sanitize.js';

describe('sanitizeHtml', () => {
  // Sichere Inhalte
  it('lässt sichere HTML-Elemente unberührt', () => {
    const input = '<p>Normaler <strong>Text</strong> mit <em>Formatierung</em>.</p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('erhält externe Links mit https-URLs und fügt target/rel hinzu', () => {
    // Phase 4: Externe Links erhalten automatisch target="_blank" rel="noopener noreferrer"
    const result = sanitizeHtml('<a href="https://example.com">Link</a>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('lässt Bilder mit https-src inhaltlich unberührt', () => {
    // Phase 4: sanitize-html wandelt void-Elemente in self-closing um (<img ... />)
    const result = sanitizeHtml('<img src="https://example.com/bild.jpg" alt="Bild">');
    expect(result).toContain('src="https://example.com/bild.jpg"');
    expect(result).toContain('alt="Bild"');
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
  });

  it('lässt class- und id-Attribute unberührt', () => {
    const input = '<div class="info-box" id="section-1"><p>Text</p></div>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  // Script-Tags
  it('entfernt <script>-Tag mit Inhalt', () => {
    const input = '<p>Text</p><script>alert("xss")</script><p>Ende</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(');
    expect(result).toContain('<p>Text</p>');
    expect(result).toContain('<p>Ende</p>');
  });

  it('entfernt mehrzeiligen <script>-Block', () => {
    const input = '<script>\nfunction evil() {\n  document.cookie = "stolen";\n}\nevil();\n</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('cookie');
  });

  // Event-Handler
  it('entfernt onclick-Attribut (und nicht-erlaubte Tags)', () => {
    // Phase 4: <button> ist nicht in der Allowlist — nur Textinhalt bleibt erhalten
    const result = sanitizeHtml('<button onclick="alert(1)">Klick</button>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('<button');
  });

  it('entfernt onload-Attribut', () => {
    const input = '<img src="https://example.com/bild.jpg" onload="stealData()">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onload');
    expect(result).toContain('src=');
  });

  it('entfernt onerror-Attribut', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });

  it('entfernt onmouseover-Attribut', () => {
    const input = '<p onmouseover="evil()">Hover</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onmouseover');
  });

  // javascript:-URLs
  it('entfernt javascript: in href', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('entfernt javascript: in src', () => {
    const input = '<img src="javascript:alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  // data:-URLs
  it('entfernt data: in href', () => {
    const input = '<a href="data:text/html,<h1>XSS</h1>">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data:');
  });

  it('entfernt data: in src', () => {
    const input = '<img src="data:image/svg+xml,<svg onload=alert(1)>">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data:');
  });

  // iframe
  it('entfernt <iframe>-Tag', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
  });

  // Null / Edge Cases
  it('gibt leeren String für null zurück', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('gibt leeren String für undefined zurück', () => {
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('gibt leeren String für leeren String zurück', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('lässt normalen Text ohne HTML unberührt', () => {
    const input = 'Nur normaler Text ohne Tags.';
    expect(sanitizeHtml(input)).toBe(input);
  });
});

// ============================================================
// containsDangerousHtml
// ============================================================

describe('containsDangerousHtml', () => {
  it('erkennt <script>-Tag', () => {
    expect(containsDangerousHtml('<script>alert(1)</script>')).toBe(true);
  });

  it('erkennt onclick-Attribut', () => {
    expect(containsDangerousHtml('<div onclick="evil()">x</div>')).toBe(true);
  });

  it('erkennt javascript: in href', () => {
    expect(containsDangerousHtml('<a href="javascript:void(0)">x</a>')).toBe(true);
  });

  it('erkennt data: in src', () => {
    expect(containsDangerousHtml('<img src="data:image/png,abc">')).toBe(true);
  });

  it('erkennt <iframe>', () => {
    expect(containsDangerousHtml('<iframe src="x"></iframe>')).toBe(true);
  });

  it('gibt false für sicheren Content ohne Transformation', () => {
    expect(containsDangerousHtml('<p>Normaler <strong>Text</strong></p>')).toBe(false);
    // Phase 4: Externe Links erhalten target/rel → Sanitizer transformiert sie → true
    // (Interne Links mit / bleiben unverändert → false)
    expect(containsDangerousHtml('<a href="/intern">Link</a>')).toBe(false);
  });

  it('gibt true für externe Links ohne target/rel (werden transformiert)', () => {
    // containsDangerousHtml = (input !== sanitizeHtml(input))
    // Externe Links ohne target/rel werden vom Sanitizer ergänzt → true
    expect(containsDangerousHtml('<a href="https://example.com">Link</a>')).toBe(true);
  });

  it('gibt false für null', () => {
    expect(containsDangerousHtml(null)).toBe(false);
  });
});
