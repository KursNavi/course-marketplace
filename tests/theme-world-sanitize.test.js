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

  it('lässt Links mit https-URLs unberührt', () => {
    const input = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('lässt Bilder mit https-src unberührt', () => {
    const input = '<img src="https://example.com/bild.jpg" alt="Bild">';
    expect(sanitizeHtml(input)).toBe(input);
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
  it('entfernt onclick-Attribut', () => {
    const input = '<button onclick="alert(1)">Klick</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<button');
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

  it('gibt false für sicheren Content', () => {
    expect(containsDangerousHtml('<p>Normaler <strong>Text</strong></p>')).toBe(false);
    expect(containsDangerousHtml('<a href="https://example.com">Link</a>')).toBe(false);
  });

  it('gibt false für null', () => {
    expect(containsDangerousHtml(null)).toBe(false);
  });
});
