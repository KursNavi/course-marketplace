/**
 * Gemeinsame <head>-Injektion für ausgelieferte SPA-Shells.
 *
 * Wird von zwei Stellen genutzt, damit Prerender und Laufzeit-Fallback nicht
 * auseinanderlaufen:
 *   - scripts/prerender-static.mjs (Build: statische HTML-Dateien)
 *   - api/thema-redirect.js (Laufzeit-Fallback für nicht übernommene Themen)
 */

/** Escaped HTML-Attributwerte. */
export function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ersetzt title/description/canonical/OG-Tags in einer index.html-Vorlage.
 *
 * @param {string} template - Inhalt von dist/index.html
 * @param {object} meta
 * @param {string} meta.canonical - absolute URL
 * @param {string} meta.title
 * @param {string} meta.description
 * @param {string} [meta.ogImage] - absolute URL
 * @returns {string}
 */
export function injectHeadMeta(template, { canonical, title, description, ogImage }) {
  let html = String(template);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeHtmlAttr(description)}$2`
  );
  // Canonical direkt nach <meta name="robots"> einfügen (falls noch nicht vorhanden)
  if (/<link rel="canonical"/.test(html)) {
    html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  } else {
    html = html.replace(
      /(<meta name="robots"[^>]*>)/,
      `$1\n    <link rel="canonical" href="${canonical}" />`
    );
  }
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeHtmlAttr(title)}$2`
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeHtmlAttr(description)}$2`
  );
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  if (ogImage) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${ogImage}$2`);
  }

  return html;
}
