/**
 * Serverseitiger 404-Fallback für die bekannten Ressourcen-Routefamilien
 * /bereich/… und /ratgeber/….
 *
 * SEO-Befund, den diese Funktion behebt (Soft-404):
 *   Eine nicht existierende Ressource — etwa
 *   /bereich/privat-hobby/audit-nicht-vorhanden-zz oder
 *   /ratgeber/beruflich/finanzierung/audit-nicht-vorhanden-zz — lief bisher in
 *   den allgemeinen SPA-Catch-all. Der erste HTTP-Response war HTTP 200 mit der
 *   generischen SPA-Shell; «Bereich nicht gefunden» bzw. «Artikel nicht
 *   gefunden» und das noindex entstanden erst nach der React-Hydration. Für
 *   Suchmaschinen sind das indexierbare 200er-Seiten ohne Inhalt.
 *
 * Routing-Kontext (Vercel) — identisch zur bestehenden /thema-Lösung
 * (siehe api/thema-redirect.js):
 *   1. `redirects` aus vercel.json
 *   2. Dateisystem — statische Dateien aus dist/ (inkl. Prerender)
 *   3. `rewrites` aus vercel.json
 *
 * Weil das Dateisystem VOR den Rewrites greift, erreicht ein Request diese
 * Funktion nur dann, wenn für die URL KEINE prerenderte Datei existiert.
 * scripts/prerender-static.mjs erzeugt beim Build eine Datei für
 *   - jeden öffentlichen /bereich-Parent (Legacy-Config + publizierte
 *     DB-Themenwelten)
 *   - jedes veröffentlichte Szenario
 *   - /ratgeber, jede Ratgeber-Kategorie, jeden Cluster und jeden Artikel
 * Ein systemischer DB-Fehler bricht den Vercel-Build ab (PR #100/#103), und
 * eine geänderte öffentliche Themenwelt-Sichtbarkeit löst einen neuen Build
 * aus. «Keine Datei» ist deshalb eine verlässliche Aussage über «existiert
 * nicht» — und kostet keine Supabase-Abfrage pro unbekanntem Request.
 *
 * Diese Funktion braucht bewusst:
 *   - keine Datenbank
 *   - keine Secrets
 *   - keine SPA-Shell im Bundle (kein `includeFiles`)
 *   - keine externen Systeme
 *
 * Sie rendert eine kleine, in sich SEO-sichere Fehlerseite. Insbesondere KEIN
 * Canonical auf die ungültige URL und KEIN Course-/Article-/Theme-World-JSON-LD.
 */

/** Titel der Fehlerseite — identisch zur hydratisierten NotFoundPage. */
export const NOT_FOUND_TITLE = 'Seite nicht gefunden | KursNavi';

/** Description der Fehlerseite. */
export const NOT_FOUND_DESCRIPTION = 'Die gesuchte Seite wurde nicht gefunden.';

/**
 * Statische Fehlerseite.
 *
 * Bewusst ohne <link rel="canonical">: Ein Self-Canonical auf die ungültige URL
 * würde sie als kanonische Ressource bestätigen, ein Canonical auf eine andere
 * Seite würde einen 404 fälschlich mit gültigem Inhalt verknüpfen. Beides ist
 * schlechter als gar kein Canonical.
 */
const NOT_FOUND_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${NOT_FOUND_TITLE}</title>
    <meta name="description" content="${NOT_FOUND_DESCRIPTION}" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1.5rem;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        color: #1f2937;
        background: #ffffff;
      }
      main { max-width: 32rem; text-align: center; }
      .code { font-size: 4rem; font-weight: 700; color: #d1d5db; margin: 0 0 .5rem; }
      h1 { font-size: 1.5rem; margin: 0 0 .75rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; line-height: 1.6; }
      .links { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: center; }
      a {
        display: inline-block;
        padding: .75rem 1.5rem;
        border-radius: 9999px;
        text-decoration: none;
        font-weight: 500;
        border: 1px solid #d1d5db;
        color: #1f2937;
      }
      a.primary { background: #f97316; border-color: #f97316; color: #ffffff; }
    </style>
  </head>
  <body>
    <main>
      <p class="code">404</p>
      <h1>Seite nicht gefunden</h1>
      <p>Die gesuchte Seite existiert nicht oder wurde verschoben.</p>
      <div class="links">
        <a class="primary" href="/search">Kurs suchen</a>
        <a href="/">Zur Startseite</a>
      </div>
    </main>
  </body>
</html>`;

/** Nur lesende Methoden ergeben für eine Fehlerseite Sinn. */
const ALLOWED_METHODS = ['GET', 'HEAD'];

export default function handler(req, res) {
  const method = String(req?.method || 'GET').toUpperCase();

  if (!ALLOWED_METHODS.includes(method)) {
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Zweite, headerbasierte Absicherung — wirkt auch für Crawler, die das
  // Markup gar nicht erst parsen.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // Kurze CDN-Cachezeit: Wird eine Themenwelt oder ein Szenario publiziert,
  // entsteht die statische Datei mit dem nächsten Build. Ein lange gecachter
  // 404 würde diesen Wechsel unnötig verzögern.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

  if (method === 'HEAD') {
    return res.status(404).end();
  }

  return res.status(404).send(NOT_FOUND_HTML);
}

/** Nur für Tests: das ausgelieferte Markup ohne HTTP-Schicht. */
export function renderNotFoundHtml() {
  return NOT_FOUND_HTML;
}
