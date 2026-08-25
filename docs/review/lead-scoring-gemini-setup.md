# Gemini-Leadbewertung — Einrichtung

## Was bereits umgesetzt ist

- serverseitiger Gemini-Adapter ohne Browserzugriff und ohne API-Key im Frontend
- JSON-Schema für die Antwort `{"score": 1..10}`
- lokale Validierung der Antwort als zweite Schutzschicht
- `store: false` für die Gemini-Interaction
- Monats-Cron `/api/cron-lead-scoring` am 1. Tag des Monats um 02:00 UTC
- Verschlüsselung des Leadtexts und automatische Löschung des Freitexts nach 60 Tagen
- Ranking-Neuberechnung erst nach erfolgreich gespeichertem Score

## Was du selbst einrichten musst

### 1. Gemini-API-Key anlegen

In [Google AI Studio](https://aistudio.google.com/app/apikey) ein Projekt auswählen
oder anlegen, die Abrechnung aktivieren und einen API-Key erzeugen. Im Projekt
muss der kostenpflichtige Plan aktiv sein. Nicht den kostenlosen Schlüssel für
personenbezogene Leadtexte verwenden.

Als Modell für den ersten Pilotlauf kann `gemini-2.5-flash` eingetragen werden.
Das konkrete Modell muss im Google-Projekt als verfügbar angezeigt werden; die
Modell-ID ist deshalb eine Vercel-Konfiguration und nicht im Code fest verdrahtet.

### 2. Vercel-Variablen setzen

Im Vercel-Projekt `course-marketplace` unter **Settings → Environment Variables**
für **Production** setzen:

| Variable | Wert |
|---|---|
| `LEAD_SCORING_PROVIDER` | `gemini` |
| `LEAD_SCORING_MODEL` | `gemini-2.5-flash` |
| `LEAD_SCORING_API_KEY` | der Gemini-API-Key |
| `LEAD_MESSAGE_ENCRYPTION_KEY` | vorhandenen AES-256-GCM-Key prüfen |
| `CRON_SECRET` | ein langer zufälliger Secret-Wert |

`LEAD_SCORING_API_KEY` darf weder mit `VITE_` beginnen noch im Chat, im
Repository oder in einer Browser-Variable auftauchen. Preview sollte zunächst
leer bleiben oder einen getrennten Test-Key bekommen.

### 3. Rechtliche und fachliche Freigabe

Vor dem ersten echten Lauf:

1. die vier aktualisierten Sprachfassungen der Datenschutzerklärung prüfen;
2. Auftragsverarbeitung, Transfergarantien und Verarbeitungsort mit Google
   prüfen und dokumentieren;
3. prüfen, ob die Rankingwirkung gegenüber Kursanbietern transparent erklärt
   werden muss;
4. eine kleine Stichprobe manuell kontrollieren und die Schwelle 5 bestätigen.

Der erste Lauf schreibt nur den Score. Es werden keine Begründungen und keine
Modellantworten gespeichert. Bei einem Anbieter- oder Parsefehler bleibt der
Lead unverändert und wird höchstens dreimal erneut versucht.

## Betrieb und Kontrolle

Nach dem Setzen der Variablen redeployen. Danach den geschützten Endpunkt einmal
manuell mit dem `CRON_SECRET` auslösen und die Vercel-Logs prüfen. In der
Admin-Konsole sollten danach `quality_status = scored`, ein Score von 1–10 und
ein aktuelles `quality_scored_at` erscheinen. Der Cron läuft anschliessend
automatisch monatlich.

Die Einrichtung ist technische Zuarbeit und ersetzt keine rechtliche Prüfung.
