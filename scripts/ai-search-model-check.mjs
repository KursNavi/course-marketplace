/**
 * Kostenfreie Vorprüfung des OpenAI-Testzugangs (Nachtrag 11):
 *  - Schlüsselart (projektgebunden?) anhand des Präfixes — der Wert selbst
 *    wird nie ausgegeben;
 *  - Zugriff auf die freigegebenen Modell-IDs über GET /v1/models/<id>
 *    (Metadatenabruf, kein kostenpflichtiger Modellaufruf).
 * Ausgabe: nur Statuscodes und Ja/Nein.
 */

const MODELS = ['gpt-6-luna', process.env.AI_SEARCH_EMBEDDING_MODEL || 'text-embedding-3-small'];

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error('Abbruch: OPENAI_API_KEY fehlt.'); process.exit(2); }
  console.log(`Schlüssel projektgebunden (Präfix sk-proj-): ${key.startsWith('sk-proj-') ? 'ja' : 'nein'}`);
  let ok = true;
  for (const model of MODELS) {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    console.log(`Modell ${model}: HTTP ${response.status}${response.ok ? ' (Zugriff vorhanden)' : ' (KEIN Zugriff)'}`);
    if (!response.ok) ok = false;
  }
  if (!ok) process.exit(1);
}

main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
