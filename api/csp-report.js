/**
 * Sammelstelle fuer CSP-Verstoesse.
 *
 * Die Content-Security-Policy laeuft bewusst zuerst nur im Messmodus
 * (`Content-Security-Policy-Report-Only` in vercel.json): Sie blockiert nichts,
 * meldet aber jeden Zugriff, den sie im scharfen Modus blockieren wuerde.
 *
 * Grund: Die Seite bindet Cookiebot, den Google Tag Manager und Contentsquare
 * ein. Diese laden zur Laufzeit weitere Adressen nach, die sich nicht
 * vollstaendig aus dem Quelltext ablesen lassen. Eine sofort scharfe Policy
 * koennte den Consent-Banner oder die Messung stillegen — im schlimmsten Fall
 * die Seite selbst. Erst wird gemessen, dann scharf geschaltet.
 *
 * Der Endpunkt ist absichtlich billig: keine Datenbank, nur ein Logeintrag mit
 * den drei Feldern, die fuer das Nachziehen der Policy zaehlen.
 */

/** Mehr als das brauchen wir nicht, und mehr wollen wir auch nicht speichern. */
function summarize(report) {
  if (!report || typeof report !== 'object') return null;
  const body = report['csp-report'] || report.body || report;
  return {
    directive: String(body['effective-directive'] || body.effectiveDirective || body['violated-directive'] || '').slice(0, 120) || null,
    blocked: String(body['blocked-uri'] || body.blockedURL || '').slice(0, 300) || null,
    documentUri: String(body['document-uri'] || body.documentURL || '').slice(0, 300) || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    // Reporting-API liefert ein Array, die aeltere report-uri ein Einzelobjekt.
    const reports = Array.isArray(payload) ? payload.slice(0, 20) : [payload];

    for (const entry of reports) {
      const summary = summarize(entry);
      // about:blank und Browser-Erweiterungen erzeugen Rauschen, das nichts
      // ueber unsere eigene Policy aussagt.
      if (!summary?.blocked) continue;
      if (/^(chrome|moz|safari)-extension:/i.test(summary.blocked)) continue;
      console.warn('csp-report:', summary);
    }
  } catch {
    // Ein unlesbarer Report darf nie einen Fehler ausloesen.
  }

  // 204: Der Browser erwartet keine Antwort.
  return res.status(204).end();
}
