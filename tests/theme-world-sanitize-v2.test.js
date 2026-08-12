/**
 * Tests für den neuen parser-basierten HTML-Sanitizer (Phase 4).
 * Prüft XSS-Vektoren, Allowlist-Korrektheit und Rückwärtskompatibilität.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, containsDangerousHtml, getSanitizerOptions } from '../api/_lib/theme-world-sanitize.js';

// ---------------------------------------------------------------------------
// Gefährliche Tags entfernen
// ---------------------------------------------------------------------------

describe('Sanitizer: Script-Tags entfernen', () => {
  it('entfernt <script>-Tags vollständig', () => {
    const input = '<p>Text</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Text</p>');
  });

  it('entfernt <script> mit Attributen', () => {
    const result = sanitizeHtml('<script src="evil.js" type="text/javascript">bad()</script>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('evil.js');
  });

  it('entfernt <script> in CDATA', () => {
    const result = sanitizeHtml('<script>//<![CDATA[\nalert(1)\n//]]></script>');
    expect(result).not.toContain('alert');
  });
});

describe('Sanitizer: iframe und andere gefährliche Tags', () => {
  it('entfernt <iframe>', () => {
    const result = sanitizeHtml('<p>Text</p><iframe src="https://evil.com" />');
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil.com');
  });

  it('entfernt <object> und <embed>', () => {
    const r1 = sanitizeHtml('<object data="evil.swf" />');
    const r2 = sanitizeHtml('<embed src="evil.swf" />');
    expect(r1).not.toContain('object');
    expect(r2).not.toContain('embed');
  });

  it('entfernt <form>', () => {
    const result = sanitizeHtml('<form action="https://phishing.com"><input type="password" /></form>');
    expect(result).not.toContain('form');
    expect(result).not.toContain('phishing.com');
  });

  it('entfernt <style>', () => {
    const result = sanitizeHtml('<style>body { display: none; }</style><p>Text</p>');
    expect(result).not.toContain('<style>');
    expect(result).toContain('<p>Text</p>');
  });

  it('entfernt <meta>', () => {
    const result = sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://evil.com"><p>Text</p>');
    expect(result).not.toContain('meta');
    expect(result).not.toContain('evil.com');
  });
});

// ---------------------------------------------------------------------------
// Event-Handler entfernen
// ---------------------------------------------------------------------------

describe('Sanitizer: Event-Handler entfernen', () => {
  it('entfernt onclick', () => {
    const result = sanitizeHtml('<p onclick="alert(1)">Text</p>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
    expect(result).toContain('Text');
  });

  it('entfernt onload', () => {
    const result = sanitizeHtml('<img src="x" onload="alert(1)" />');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
  });

  it('entfernt onerror', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)" />');
    expect(result).not.toContain('onerror');
  });

  it('entfernt onmouseover', () => {
    const result = sanitizeHtml('<a href="/" onmouseover="evil()">Link</a>');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('Link');
  });

  it('entfernt alle on*-Handler (generisch)', () => {
    const result = sanitizeHtml('<div onsubmit="x" onfocus="y" onblur="z">Text</div>');
    expect(result).not.toMatch(/on[a-z]+=/);
    expect(result).toContain('Text');
  });
});

// ---------------------------------------------------------------------------
// Gefährliche Protokolle entfernen
// ---------------------------------------------------------------------------

describe('Sanitizer: Gefährliche Protokolle entfernen', () => {
  it('entfernt javascript: in href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('entfernt javascript: mit Leerzeichen', () => {
    const result = sanitizeHtml('<a href="  javascript:alert(1)">Link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('entfernt data: in src', () => {
    const result = sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>" />');
    expect(result).not.toContain('data:');
  });

  it('entfernt vbscript: in href', () => {
    const result = sanitizeHtml('<a href="vbscript:MsgBox(1)">Link</a>');
    expect(result).not.toContain('vbscript:');
  });
});

// ---------------------------------------------------------------------------
// Erlaubte Formatierung erhalten
// ---------------------------------------------------------------------------

describe('Sanitizer: Erlaubte redaktionelle Formatierung erhalten', () => {
  it('erhält Überschriften h2-h4', () => {
    const input = '<h2>Titel</h2><h3>Untertitel</h3><h4>Sub</h4>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<h2>Titel</h2>');
    expect(result).toContain('<h3>Untertitel</h3>');
    expect(result).toContain('<h4>Sub</h4>');
  });

  it('erhält Absätze und Listen', () => {
    const input = '<p>Text</p><ul><li>A</li><li>B</li></ul><ol><li>1</li></ol>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>');
  });

  it('erhält Inline-Formatierung', () => {
    const input = '<p><strong>Fett</strong> und <em>kursiv</em></p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });

  it('erhält interne Links', () => {
    const input = '<a href="/search?q=yoga">Yoga-Kurse</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="/search?q=yoga"');
    expect(result).toContain('Yoga-Kurse');
  });

  it('erhält externe Links mit sicheren Protokollen', () => {
    const input = '<a href="https://qualitop.ch">Qualitop</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://qualitop.ch"');
    expect(result).toContain('Qualitop');
  });

  it('erhält Bilder mit https://', () => {
    const input = '<img src="https://example.com/bild.jpg" alt="Bild" />';
    const result = sanitizeHtml(input);
    expect(result).toContain('src="https://example.com/bild.jpg"');
    expect(result).toContain('alt="Bild"');
  });

  it('erhält blockquote', () => {
    const input = '<blockquote><p>Zitat</p></blockquote>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<blockquote>');
    expect(result).toContain('Zitat');
  });

  it('erhält code und pre', () => {
    const input = '<pre><code>const x = 1;</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });
});

// ---------------------------------------------------------------------------
// Klassen und IDs
// ---------------------------------------------------------------------------

describe('Sanitizer: class und id-Attribute', () => {
  it('erhält class-Attribute für erlaubte Tags', () => {
    const result = sanitizeHtml('<p class="info-box">Info</p>');
    expect(result).toContain('class="info-box"');
  });

  it('erhält id-Attribute', () => {
    const result = sanitizeHtml('<h2 id="section-1">Abschnitt</h2>');
    expect(result).toContain('id="section-1"');
  });
});

// ---------------------------------------------------------------------------
// Leere / Null-Eingaben
// ---------------------------------------------------------------------------

describe('Sanitizer: Randwerte', () => {
  it('gibt leeren String für null zurück', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('gibt leeren String für undefined zurück', () => {
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('gibt leeren String für leeren String zurück', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('erhält normalen Text', () => {
    const result = sanitizeHtml('Nur Text');
    expect(result).toContain('Nur Text');
  });
});

// ---------------------------------------------------------------------------
// containsDangerousHtml
// ---------------------------------------------------------------------------

describe('containsDangerousHtml', () => {
  it('gibt true zurück für Script-Tag', () => {
    expect(containsDangerousHtml('<script>alert(1)</script>')).toBe(true);
  });

  it('gibt true zurück für onclick', () => {
    expect(containsDangerousHtml('<p onclick="bad()">Text</p>')).toBe(true);
  });

  it('gibt true zurück für javascript: URL', () => {
    expect(containsDangerousHtml('<a href="javascript:alert(1)">Link</a>')).toBe(true);
  });

  it('gibt false zurück für sicheres HTML', () => {
    expect(containsDangerousHtml('<p class="info"><strong>OK</strong></p>')).toBe(false);
  });

  it('gibt false zurück für null', () => {
    expect(containsDangerousHtml(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSanitizerOptions
// ---------------------------------------------------------------------------

describe('getSanitizerOptions', () => {
  it('gibt ein Konfigurationsobjekt zurück', () => {
    const opts = getSanitizerOptions();
    expect(opts).toBeDefined();
    expect(Array.isArray(opts.allowedTags)).toBe(true);
    expect(opts.allowedTags).toContain('p');
    expect(opts.allowedTags).toContain('a');
    expect(opts.allowedTags).not.toContain('script');
    expect(opts.allowedTags).not.toContain('iframe');
  });
});

// ---------------------------------------------------------------------------
// Bekannte XSS-Vektoren
// ---------------------------------------------------------------------------

describe('Sanitizer: Bekannte XSS-Vektoren', () => {
  const vectors = [
    '<IMG SRC=javascript:alert("XSS")>',
    '<BODY ONLOAD=alert("XSS")>',
    '<<SCRIPT>alert("XSS");//<</SCRIPT>',
    '<script/xss src="http://ha.ckers.org/xss.js"></script>',
    '<IMG """><SCRIPT>alert("XSS")</SCRIPT>">',
    '<a href="java&#x09;script:alert(1)">Click</a>',
    '<svg/onload=alert(1)>',
    '<input type="image" src="javascript:alert(\'XSS\')" />',
  ];

  vectors.forEach((vector, i) => {
    it(`XSS-Vektor ${i + 1}: ${vector.substring(0, 40)}…`, () => {
      const result = sanitizeHtml(vector);
      // Ergebnis darf keine Script-Ausführung ermöglichen
      expect(result).not.toMatch(/javascript:/i);
      expect(result).not.toMatch(/<script/i);
      expect(result).not.toMatch(/on[a-z]+\s*=/i);
      expect(result).not.toContain('alert(');
    });
  });
});
