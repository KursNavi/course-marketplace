# OFFEN vor Produktivsetzung — Lead-Analyse Phase 1

> **Status: OFFEN.** Dieses Dokument listet Entscheidungen, die die
> Implementierung bewusst **nicht** getroffen hat, weil sie dem Betreiber
> zustehen. Die Lead-Analyse ist funktionsfähig und schadensfrei deploybar,
> **bevor** diese Punkte geklärt sind — die KI-Bewertung bleibt bis dahin
> inaktiv. Vor dem Scharfschalten der Bewertung müssen Punkt 1 **und** Punkt 2
> erledigt sein.

---

## 1. KI-Anbieter ist nicht festgelegt

### Befund

Das Projekt hat **keinen** serverseitigen KI-Anbieter:

- kein KI-SDK in `package.json` (`@anthropic-ai/sdk`, `openai`, … fehlen alle),
- kein KI-Schlüssel in `.env.example`,
- kein bestehender Code, der ein Sprachmodell aufruft.

Es wurde deshalb **kein Anbieter ausgewählt und kein Vendor-SDK hinzugefügt**.
Einen Anbieter stillschweigend zu setzen wäre eine Auftragsverarbeiter-
Entscheidung mit Datenschutz- und Kostenfolgen — die trifft der Betreiber.

### Was bereits fertig ist

- Adapter-Schnittstelle, Registry und Konfigurationsprüfung
  (`api/_lib/lead-scoring.js`)
- Promptaufbau inklusive Schutz gegen Prompt-Injection
- strikte Antwortvalidierung (`parseScoreResult`)
- Batchlogik mit Fehlerbehandlung, Versuchslimit und Zeitbudget
- monatlicher Cron-Endpunkt (`api/cron-lead-scoring.js`)
- manuelle Wiederholung über das Admin-Panel
- Tests mit austauschbarem Fake-Scorer — **ohne** echte Modellaufrufe

### Was noch zu tun ist

**a) Anbieter und Modell auswählen.** Zu klären sind mindestens:
Verarbeitungsstandort, Auftragsverarbeitungsvertrag, Zusicherung „kein Training
auf Kundendaten", Kosten pro Bewertung, Verfügbarkeit.

**b) Adapter registrieren.** Eine Funktion in `api/_lib/lead-scoring.js`:

```js
registerScoringAdapter('<name>', async ({ system, user, model, apiKey, signal }) => {
  // fetch() gegen die Anbieter-API; Rohantwort zurückgeben.
  // Keine eigene Validierung — das macht parseScoreResult().
});
```

Ein SDK ist nicht nötig; `fetch` genügt und vermeidet eine neue Abhängigkeit.

**c) Umgebungsvariablen setzen** (Vercel, Production + Preview):

| Variable | Beispiel |
|---|---|
| `LEAD_SCORING_PROVIDER` | der unter (b) registrierte Adaptername |
| `LEAD_SCORING_MODEL` | Modellbezeichnung des Anbieters |
| `LEAD_SCORING_API_KEY` | API-Schlüssel des Anbieters |

### Verhalten bis dahin

- `/api/cron-lead-scoring` antwortet `501 lead_scoring_not_configured`.
  Das ist **kein Ausfall**, sondern der dokumentierte Zustand.
- Leads werden weiterhin vollständig erfasst und sammeln sich mit
  `quality_status = 'pending'`.
- Der Anfragetext wird verschlüsselt gespeichert und nach 60 Tagen gelöscht.
  **Leads, deren Text abläuft, bevor die Bewertung konfiguriert ist, können
  nicht mehr bewertet werden** (`quality_status = 'expired_unscored'`).
  → Wer die Bewertung rückwirkend haben will, muss innerhalb von 60 Tagen
  konfigurieren.
- Die Basic-Ranking-Penalty bleibt bei Faktor `1.00` für alle, weil ohne Scores
  kein Lead als qualifiziert gilt. Niemand wird zu Unrecht abgestuft.

---

## 2. Datenschutzerklärung muss ergänzt werden

### Befund

Die aktuelle Datenschutzerklärung (`src/lib/legalText.js`,
`PRIVACY_VERSION = "2026-06-21"`) deckt die neue Bearbeitung **nicht** ab:

- Ziffer 3 „Zwecke der Bearbeitung" nennt Weiterleitung, Dokumentation und
  Missbrauchsprävention — **keine automatisierte Qualitätsanalyse**.
- Ziffer 4 „Technische Infrastruktur & Drittanbieter" listet Vercel, Supabase,
  Stripe, Resend, Sentry — **keinen KI-Dienstleister**.
- Ziffer 8 „Speicherdauer" ist allgemein gehalten — die konkrete 60-Tage-Frist
  für den Anfragetext ist nicht genannt.

Die Erklärung wurde **bewusst nicht geändert**: Ohne feststehenden Anbieter
liesse sich Ziffer 4 nur mit einem erfundenen Namen füllen. Ausserdem berührt
jede Änderung `PRIVACY_VERSION` und damit den Consent-Nachweis.

### Neu zu beschreibende Bearbeitung

| Punkt | Sachverhalt |
|---|---|
| Was | Freitext der Kursanfrage |
| Zweck | automatisierte Qualitätsbewertung (Score 1–10) zur Missbrauchserkennung und zur Steuerung der Anbietersichtbarkeit |
| Wie | serverseitig verschlüsselt gespeichert (AES-256-GCM), monatlich an ein Sprachmodell übermittelt |
| Aufbewahrung | Anfragetext max. **60 Tage**; danach bleibt nur der Score (1–10) ohne Textbezug |
| Ergebnis | **nur** eine Zahl 1–10. Keine Begründung, keine Teilbewertungen, keine Textausschnitte werden gespeichert |
| Empfänger | *(offen — abhängig von Punkt 1)* |
| Ort | *(offen — abhängig von Punkt 1)* |

### Textentwurf — vom Betreiber zu prüfen und zu vervollständigen

Platzhalter in `«…»` müssen ersetzt werden.

**Ziffer 3, neuer Aufzählungspunkt:**

> • Automatisierte Qualitätsbewertung von Kursanfragen zur Erkennung von Spam
> und Missbrauch sowie zur Steuerung der Sichtbarkeit von Anbietern auf der
> Plattform

**Ziffer 4, neuer Aufzählungspunkt:**

> • Qualitätsbewertung von Anfragen: «Anbietername, Sitz». Der Text Ihrer
> Anfrage wird zur automatisierten Bewertung an diesen Dienstleister
> übermittelt. Der Dienstleister verwendet die Daten nicht zum Training eigener
> Modelle. Verarbeitungsort: «Land/Region».

**Ziffer 8, Ergänzung:**

> Der Freitext einer Kursanfrage wird verschlüsselt gespeichert und spätestens
> 60 Tage nach Eingang automatisch gelöscht. Erhalten bleibt anschliessend
> lediglich eine Qualitätskennzahl von 1 bis 10 ohne Bezug zum ursprünglichen
> Text sowie die technische Dokumentation der Übermittlung.

### Weitere Prüfpunkte für den Betreiber

- **Alle vier Sprachfassungen** anpassen (de, en, fr, it) — `legalText.js`
  enthält jede Fassung separat.
- **`PRIVACY_VERSION`** in `src/lib/legalVersions.js` erhöhen. Dies löst den
  Consent-Nachweis-Mechanismus aus; die Auswirkung auf bestehende Nutzer ist
  vorab zu prüfen.
- **Automatisierte Einzelentscheidung** (Art. 21 nDSG): Der Score beeinflusst
  die Sichtbarkeit des **Anbieters**, nicht eine Entscheidung über die
  anfragende Person. Nach hiesiger Einschätzung liegt keine automatisierte
  Einzelentscheidung mit Rechtsfolge für die betroffene Person vor — **das ist
  juristisch zu bestätigen, nicht anzunehmen.**
- **Anbieterinformation:** Anbieter werden anhand ihrer Leadqualität im Ranking
  abgestuft. Ob und wo das offenzulegen ist (AGB, Paketbeschreibung, FAQ), ist
  eine Entscheidung des Betreibers.
- **Auftragsverarbeitungsvertrag** mit dem KI-Dienstleister abschliessen.
- **Bekanntgabe ins Ausland** (Ziffer 7) prüfen, falls der Anbieter ausserhalb
  von Schweiz/EU verarbeitet.

> **Die rechtliche Endprüfung obliegt dem Betreiber.** Die Entwürfe oben sind
> technische Zuarbeit, keine Rechtsberatung.

---

## 3. Weitere Betriebsentscheidungen

### `LEAD_MESSAGE_ENCRYPTION_KEY` setzen

Ohne diesen Schlüssel wird **kein** Anfragetext gespeichert. Leads und
E-Mail-Versand laufen unverändert weiter, eine KI-Bewertung ist dann aber nie
möglich. Betroffene Leads tragen `quality_error_code = 'payload_write_failed'`.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Als Server-Variable setzen — **nie** mit `VITE_`-Präfix.

### `CRON_SECRET` setzen

`/api/cron-lead-scoring` verweigert ohne gesetztes `CRON_SECRET` den Dienst
(503). Das ist Absicht: Der Endpunkt entschlüsselt personenbezogene Texte und
verursacht Kosten.

Hinweis: Der bestehende `/api/cron` prüft **kein** Secret. Das ist Altbestand
und wurde hier nicht verändert — aber ein Punkt, den der Betreiber unabhängig
von dieser Phase prüfen sollte.

### `cleanup_old_leads()` entfernen

Die Funktion ist wirkungslos und existiert nur als Kompatibilitätshülle für den
Fall, dass die Migration vor dem Code-Deploy läuft. Nach erfolgreichem Deploy
von `api/cron.js` kann sie ersatzlos gelöscht werden.
