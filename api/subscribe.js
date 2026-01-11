export default async function handler(req, res) {
  // 1. Methode prüfen
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. E-Mail extrahieren
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Ungültige E-Mail Adresse' });
    }

    // 3. API Key prüfen
    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) {
      throw new Error('SERVER CONFIG FEHLER: BREVO_API_KEY fehlt in den Vercel Settings.');
    }

    // 4. Daten an Brevo senden
    // ID 5 ist deine Liste. Stelle sicher, dass Liste mit ID 5 in Brevo existiert!
    const LIST_ID = 5; 

    console.log(`Versuche Anmeldung für ${email} bei Liste ${LIST_ID}...`);

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        email: email,
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

      // Fehler sauber ans Frontend weitergeben (kein throw -> kein 500)
      return res.status(response.status).json({
        success: false,
        code: data?.code,
        message: data?.message || 'Brevo API Fehler'
      });
    }

    // OK (auch wenn 204, dann ist data einfach {})
    return res.status(200).json({ success: true, already: false });

  } catch (error) {
    console.error('Newsletter Critical Error:', error);
    // WICHTIG: Den Fehler an das Frontend senden, damit wir ihn sehen
    return res.status(500).json({ 
      error: 'Server Error', 
      details: error.message 
    });
  }
}