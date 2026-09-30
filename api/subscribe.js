/**
 * Newsletter-Anmeldung über Brevo.
 *
 * Drei Probleme, die hier behoben sind:
 *
 * 1. Die Erkennung "schon angemeldet" lag im Fehlerzweig und kam nie zum Zug.
 *    Mit `updateEnabled: true` meldet Brevo bei einer bereits bekannten
 *    Adresse nämlich gar keinen Fehler, sondern schlicht Erfolg — die
 *    Besucherin las jedes Mal "erfolgreich angemeldet". Jetzt wird vorher
 *    nachgesehen, ob der Kontakt existiert.
 *
 * 2. Der Endpunkt schrieb aus JEDER Umgebung in dieselbe Live-Liste. Eine
 *    Testanmeldung auf einer Preview landete damit im echten Verteiler.
 *    Ausserhalb der Produktion wird jetzt nur noch simuliert, solange keine
 *    eigene Testliste konfiguriert ist.
 *
 * 3. Kein Honeypot, kein Limit. Der Honeypot ist ergänzt; zur Grenze des
 *    Limits siehe den Kommentar bei `burstLimitUeberschritten`.
 */

const DEFAULT_LIST_ID = 5;

/**
 * Kurzzeit-Bremse gegen Massenanmeldungen.
 *
 * WICHTIG — bewusste Einschränkung: Serverless-Funktionen laufen in mehreren
 * Instanzen, dieser Speicher gilt immer nur für eine davon. Die Bremse fängt
 * naive Schleifen ab, aber keinen verteilten Angriff. Der belastbare Schutz
 * wäre eine Rate-Limit-Regel der Vercel-Firewall auf /api/subscribe — das ist
 * Konfiguration, kein Code. Eine Datenbanktabelle gibt es für den Newsletter
 * nicht, und eine halbfertige neue anzulegen wäre schlechter als diese klar
 * benannte Grenze.
 */
const BURST_FENSTER_MS = 60 * 1000;
const BURST_MAX = 5;
const burstSpeicher = new Map();

function burstLimitUeberschritten(schluessel) {
  if (!schluessel) return false;
  const jetzt = Date.now();
  const treffer = (burstSpeicher.get(schluessel) || []).filter((t) => jetzt - t < BURST_FENSTER_MS);
  treffer.push(jetzt);
  burstSpeicher.set(schluessel, treffer);

  // Speicher klein halten: alte Einträge gelegentlich wegwerfen.
  if (burstSpeicher.size > 500) {
    for (const [k, v] of burstSpeicher) {
      if (!v.some((t) => jetzt - t < BURST_FENSTER_MS)) burstSpeicher.delete(k);
    }
  }

  return treffer.length > BURST_MAX;
}

function clientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '');
  return raw.split(',')[0].trim() || String(req?.socket?.remoteAddress || '').trim();
}

/**
 * In welche Liste darf geschrieben werden?
 * Produktion: die konfigurierte Liste. Sonst nur eine ausdrücklich gesetzte
 * Testliste. Ohne Testliste wird ausserhalb der Produktion gar nicht geschrieben.
 */
export function resolveListTarget(env = process.env) {
  const istProduktion = (env.VERCEL_ENV || 'development') === 'production';
  const liveListe = Number(env.BREVO_LIST_ID || DEFAULT_LIST_ID);
  const testListe = Number(env.BREVO_TEST_LIST_ID || 0);

  if (istProduktion) return { schreiben: true, listId: liveListe };
  if (testListe > 0) return { schreiben: true, listId: testListe };
  return { schreiben: false, listId: null };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, _company } = req.body || {};

    // Honeypot: stille Erfolgsmeldung, damit Bots nichts lernen.
    if (_company) {
      return res.status(200).json({ success: true, already: false });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Ungültige E-Mail Adresse' });
    }

    if (burstLimitUeberschritten(clientIp(req))) {
      return res.status(429).json({ error: 'Zu viele Anmeldungen in kurzer Zeit. Bitte versuche es später erneut.' });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const ziel = resolveListTarget();
    if (!ziel.schreiben) {
      // Preview und lokale Entwicklung fassen den echten Verteiler nicht an.
      console.warn('subscribe: ausserhalb der Produktion — Anmeldung wird nur simuliert.');
      return res.status(200).json({ success: true, already: false, simulated: true });
    }

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) {
      throw new Error('BREVO_API_KEY fehlt in den Vercel Settings.');
    }

    const brevoHeaders = {
      'Content-Type': 'application/json',
      'api-key': BREVO_KEY,
      accept: 'application/json',
    };

    // 1. Gibt es den Kontakt schon — und steckt er bereits in dieser Liste?
    const vorhanden = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(sanitizedEmail)}`,
      { headers: brevoHeaders },
    );

    if (vorhanden.ok) {
      const kontakt = await vorhanden.json().catch(() => ({}));
      const listen = Array.isArray(kontakt?.listIds) ? kontakt.listIds : [];
      if (listen.includes(ziel.listId)) {
        return res.status(200).json({ success: true, already: true, message: 'Bereits angemeldet' });
      }
      // Bekannt, aber noch nicht in dieser Liste — unten wird er ergänzt.
    } else if (vorhanden.status !== 404) {
      console.error('subscribe: Brevo-Abfrage fehlgeschlagen', { status: vorhanden.status });
      return res.status(502).json({ error: 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.' });
    }

    // 2. Anlegen bzw. der Liste hinzufügen.
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: brevoHeaders,
      body: JSON.stringify({
        email: sanitizedEmail,
        listIds: [ziel.listId],
        updateEnabled: true,
      }),
    });

    if (!response.ok) {
      const rohtext = await response.text();
      let daten = {};
      try {
        daten = rohtext ? JSON.parse(rohtext) : {};
      } catch {
        daten = { message: rohtext };
      }

      // Wettlauf mit einer parallelen Anmeldung — kein Fehler für die Besucherin.
      const code = String(daten?.code || '').toLowerCase();
      const meldung = String(daten?.message || '').toLowerCase();
      if (code === 'duplicate_parameter' || meldung.includes('already exist')) {
        return res.status(200).json({ success: true, already: true, message: 'Bereits angemeldet' });
      }

      // Details bleiben im Log — der Endpunkt ist öffentlich erreichbar, und
      // Brevo-Codes verraten Interna der Listenkonfiguration.
      console.error('subscribe: Brevo lehnte die Anmeldung ab', {
        status: response.status,
        code: daten?.code || null,
        message: daten?.message || null,
      });
      return res.status(502).json({
        success: false,
        error: 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.',
      });
    }

    return res.status(200).json({ success: true, already: false });
  } catch (error) {
    // Hier landet unter anderem der fehlende BREVO_API_KEY — nichts davon
    // gehört in den Browser.
    console.error('Newsletter Critical Error:', error);
    return res.status(500).json({
      error: 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.',
    });
  }
}
