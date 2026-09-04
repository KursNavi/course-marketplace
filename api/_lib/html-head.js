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

/** Marker-Attribut aller vom Build erzeugten JSON-LD-Blöcke. */
export const PRERENDERED_JSONLD_ATTR = 'data-prerender-jsonld';

/** Findet zuvor injizierte JSON-LD-Blöcke (verhindert Duplikate). */
const PRERENDERED_JSONLD_BLOCK = new RegExp(
  `\\s*<script type="application/ld\\+json" ${PRERENDERED_JSONLD_ATTR}="[^"]*">[\\s\\S]*?<\\/script>`,
  'g'
);

/**
 * Serialisiert ein JSON-LD-Objekt für die Einbettung in <script>.
 *
 * `<` wird zu < escaped — nur so kann ein Datenwert die Script-Umgebung
 * nicht per "</script>" verlassen. Der Wert bleibt gültiges JSON und damit
 * für Suchmaschinen identisch zum Laufzeit-JSON aus React.
 */
function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Ersetzt title/description/canonical/OG-Tags in einer index.html-Vorlage.
 *
 * @param {string} template - Inhalt von dist/index.html
 * @param {object} meta
 * @param {string} meta.canonical - absolute URL
 * @param {string} meta.title
 * @param {string} meta.description
 * @param {string} [meta.robots] - robots directive, e.g. `noindex,follow`
 * @param {string} [meta.ogTitle] - abweichender og:title (Standard: title)
 * @param {string} [meta.ogDescription] - abweichende og:description (Standard: description)
 * @param {string} [meta.ogType] - z.B. 'website'; ohne Wert bleibt die Vorlage unverändert
 * @param {string} [meta.ogImage] - absolute URL
 * @param {string} [meta.ogImageAlt] - Alt-Text zum OG-Bild; nur bei sinnvollem
 *        Wert wird <meta property="og:image:alt"> erzeugt.
 * @param {object[]} [meta.jsonLd] - strukturierte Daten; werden als
 *        <script type="application/ld+json" data-prerender-jsonld> vor </head>
 *        eingefügt. Bereits vorhandene Blöcke mit diesem Marker werden zuvor
 *        entfernt, damit eine erneute Injektion nichts dupliziert.
 * @returns {string}
 */
export function injectHeadMeta(template, {
  canonical,
  title,
  description,
  robots,
  ogTitle,
  ogDescription,
  ogType,
  ogImage,
  ogImageAlt,
  jsonLd,
}) {
  let html = String(template);
  // Kurs- und Anbieterseiten nutzen einen anderen og:title als den <title>
  // (die Marke steckt dort bereits in og:site_name). Ohne expliziten Wert
  // bleibt das bisherige Verhalten: og:title/og:description = title/description.
  const socialTitle = ogTitle === undefined ? title : ogTitle;
  const socialDescription = ogDescription === undefined ? description : ogDescription;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeHtmlAttr(description)}$2`
  );
  if (robots) {
    html = html.replace(
      /(<meta name="robots" content=")[^"]*(")/,
      `$1${escapeHtmlAttr(robots)}$2`
    );
  }
  // Canonical direkt nach <meta name="robots"> einfügen (falls noch nicht vorhanden)
  if (/<link rel="canonical"/.test(html)) {
    html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  } else {
    html = html.replace(
      /(<meta name="robots"[^>]*>)/,
      `$1\n    <link rel="canonical" href="${canonical}" />`
    );
  }
  if (ogType) {
    html = html.replace(
      /(<meta property="og:type" content=")[^"]*(")/,
      `$1${escapeHtmlAttr(ogType)}$2`
    );
  }
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeHtmlAttr(socialTitle)}$2`
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeHtmlAttr(socialDescription)}$2`
  );
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  if (ogImage) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${ogImage}$2`);
  }

  // og:image:alt nur ausgeben, wenn ein redaktioneller Alt-Text vorhanden ist —
  // identisch zur Laufzeitlogik in BereichLandingPage/SzenarioArtikelView.
  const altText = typeof ogImageAlt === 'string' ? ogImageAlt.trim() : '';
  if (altText) {
    const altTag = `<meta property="og:image:alt" content="${escapeHtmlAttr(altText)}" />`;
    if (/<meta property="og:image:alt"/.test(html)) {
      html = html.replace(
        /(<meta property="og:image:alt" content=")[^"]*(")/,
        `$1${escapeHtmlAttr(altText)}$2`
      );
    } else if (/<meta property="og:image" content="/.test(html)) {
      html = html.replace(
        /(<meta property="og:image" content="[^"]*"\s*\/?>)/,
        `$1\n    ${altTag}`
      );
    }
  }

  // Strukturierte Daten. Der Marker erlaubt der hydratisierenden React-Seite,
  // genau diese Blöcke zu entfernen statt sie zu duplizieren.
  html = html.replace(PRERENDERED_JSONLD_BLOCK, '');
  const schemas = (jsonLd || []).filter(Boolean);
  if (schemas.length > 0) {
    const blocks = schemas
      .map(
        (schema, index) =>
          `    <script type="application/ld+json" ${PRERENDERED_JSONLD_ATTR}="${index}">${serializeJsonLd(schema)}</script>`
      )
      .join('\n');
    html = html.replace(/([ \t]*)<\/head>/, `${blocks}\n$1</head>`);
  }

  return html;
}
