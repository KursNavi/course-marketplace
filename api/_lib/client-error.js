/**
 * Fehlerantworten an den Client — ohne Interna preiszugeben.
 *
 * Bisher gaben rund 25 Endpunkte `error: error.message` zurueck. Bei einem
 * unerwarteten Fehler ist das die rohe Meldung aus Postgres, Supabase oder
 * Stripe: Tabellen-, Spalten- und Constraint-Namen, interne IDs. Auf
 * oeffentlich erreichbaren Endpunkten (subscribe, provider, sitemap) ging das
 * an jeden, der die URL kennt.
 *
 * Gleichzeitig darf nicht pauschal alles verschluckt werden: Das Frontend
 * zeigt `data.error` an vielen Stellen direkt an, und Meldungen wie
 * "Nicht genuegend Guthaben" oder die aufbereiteten Stripe-Hinweise aus
 * toStripeClientMessage() sind genau dafuer gedacht.
 *
 * Unterschieden wird darum ueber die Absicht, nicht ueber den Inhalt:
 * Ein Fehler, der ueber `clientError()` erzeugt wurde, ist ausdruecklich fuer
 * den Client bestimmt und wird durchgereicht. Alles andere wird geloggt und
 * durch eine allgemeine Meldung ersetzt.
 */

const CLIENT_SAFE = Symbol.for('kursnavi.clientSafeError');

/**
 * Erzeugt einen Fehler, dessen Meldung bewusst an den Client gehen darf.
 *
 * @param {string} message  Text, den die Nutzerin lesen soll
 * @param {number} status   HTTP-Status (Standard 400)
 */
export function clientError(message, status = 400) {
  const error = new Error(message);
  error[CLIENT_SAFE] = true;
  error.status = status;
  return error;
}

/** Markiert einen bereits bestehenden Fehler als fuer den Client bestimmt. */
export function markClientSafe(error, status) {
  if (error && typeof error === 'object') {
    error[CLIENT_SAFE] = true;
    if (status) error.status = status;
  }
  return error;
}

export function isClientSafe(error) {
  return Boolean(error && typeof error === 'object' && error[CLIENT_SAFE]);
}

/**
 * Einheitliche Fehlerantwort.
 *
 * Loggt den vollstaendigen Fehler serverseitig und antwortet dem Client mit
 * der freigegebenen Meldung — oder, wenn keine vorliegt, mit `fallback`.
 *
 * @param {object} res
 * @param {string} context   Praefix fuers Log, z. B. 'send-lead'
 * @param {unknown} error
 * @param {string} fallback  Allgemeine Meldung fuer unerwartete Faelle
 * @param {number} status    Status fuer unerwartete Faelle (Standard 500)
 */
export function respondWithError(res, context, error, fallback, status = 500) {
  console.error(`${context}:`, error);

  if (isClientSafe(error)) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  return res.status(status).json({ error: fallback });
}
