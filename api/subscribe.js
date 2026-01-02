// api/subscribe.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Force Update V2
  const rawEmail = req.body.email;
  const email = rawEmail ? rawEmail.trim() : '';

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const BREVO_KEY = process.env.BREVO_API_KEY;
    
    // --- DEBUGGING START ---
    console.log("Versuche Brevo Key zu lesen...");
    if (!BREVO_KEY) {
        console.error("FEHLER: BREVO_API_KEY ist undefined/leer!");
        throw new Error("Key not configured in Vercel");
    } else {
        console.log("Key gefunden. Länge:", BREVO_KEY.length);
        console.log("Key Start:", BREVO_KEY.substring(0, 5)); // Zeigt nur "..."
    }
    // --- DEBUGGING END ---
    // 
    
    // Die ID deiner Liste bei Brevo. 
    // Falls du keine hast, erstelle eine Liste "Newsletter" und setze die ID hier ein (z.B. 2).
    // Wenn du es leer lässt, landet der Kontakt meist in der Standard-Liste.
    const LIST_ID = 5; 

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
        updateEnabled: true // Aktualisiert den User, falls er schon existiert
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Fehlercode "duplicate_parameter" ignorieren wir (User ist schon angemeldet -> Erfolg)
      if (data.code === 'duplicate_parameter') {
        return res.status(200).json({ success: true, message: 'Bereits angemeldet' });
      }
      throw new Error(data.message || 'Brevo API Error');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Newsletter Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}