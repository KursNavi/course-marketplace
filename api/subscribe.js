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

    // 5. Brevo Antwort verarbeiten
    const data = await response.json();

    if (!response.ok) {
      // Brevo Fehler abfangen
      if (data.code === 'duplicate_parameter') {
        return res.status(200).json({ success: true, message: 'Bereits angemeldet' });
      }
      // Den echten Fehler von Brevo zurückgeben
      throw new Error(`Brevo API Fehler: ${data.message || JSON.stringify(data)}`);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Newsletter Critical Error:', error);
    // WICHTIG: Den Fehler an das Frontend senden, damit wir ihn sehen
    return res.status(500).json({ 
      error: 'Server Error', 
      details: error.message 
    });
  }
}