export default async function handler(req, res) {
  // 1. Methode prüfen
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. E-Mail extrahieren und validieren
    const { email } = req.body;

    // Robuste Email-Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Ungültige E-Mail Adresse' });
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase();

    // 3. API Key prüfen
    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) {
      throw new Error('SERVER CONFIG FEHLER: BREVO_API_KEY fehlt in den Vercel Settings.');
    }

    // 4. Daten an Brevo senden
    // ID 5 ist deine Liste. Stelle sicher, dass Liste mit ID 5 in Brevo existiert!
    const LIST_ID = 5; 

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        email: sanitizedEmail,
        listIds: [LIST_ID],
        updateEnabled: true
      })
    });

        // 5. Brevo Antwort verarbeiten (wichtig: kann auch 204 No Content sein)
    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      data = { message: rawText };
    }

    const isDuplicate = (payload) => {
      const code = (payload?.code || '').toString().toLowerCase();
      const msg = (payload?.message || '').toString().toLowerCase();

      // Brevo liefert bei bestehenden Kontakten häufig "duplicate_parameter" + "Contact already exist"
      // oder allgemein Meldungen, die "already exist" enthalten.
      return (
        code === 'duplicate_parameter' ||
        msg.includes('already exist') ||
        msg.includes('already in list')
      );
    };

    if (!response.ok) {
      if (isDuplicate(data)) {
        return res.status(200).json({ success: true, already: true, message: 'Bereits angemeldet' });
      }

      // Der genaue Brevo-Fehler bleibt im Log. Nach aussen geht nur eine
      // allgemeine Meldung — der Endpunkt ist oeffentlich erreichbar, und
      // Brevo-Codes und -Texte verraten Interna der Listenkonfiguration.
      console.error('subscribe: Brevo lehnte die Anmeldung ab', {
        status: response.status,
        code: data?.code || null,
        message: data?.message || null,
      });
      return res.status(502).json({
        success: false,
        error: 'Die Anmeldung ist gerade nicht moeglich. Bitte versuche es spaeter erneut.'
      });
    }

    // OK (auch wenn 204, dann ist data einfach {})
    return res.status(200).json({ success: true, already: false });

  } catch (error) {
    // Details nur ins Log — hier landet unter anderem der fehlende
    // BREVO_API_KEY, der nichts im Browser verloren hat.
    console.error('Newsletter Critical Error:', error);
    return res.status(500).json({
      error: 'Die Anmeldung ist gerade nicht moeglich. Bitte versuche es spaeter erneut.'
    });
  }
}