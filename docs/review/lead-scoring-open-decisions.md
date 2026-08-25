# Vor Produktivsetzung — Lead-Analyse Phase 1

> **Status: Technische Umsetzung erledigt; rechtliche Freigabe offen.**
> Gemini ist als Anbieter integriert und der Scoring-Cron ist vorbereitet.
> Die KI-Bewertung bleibt inaktiv, bis die Vercel-Konfiguration gesetzt und die
> Datenschutzerklärung sowie die Auftragsverarbeitung rechtlich geprüft sind.

---

## 1. KI-Anbieter: Gemini ausgewählt

### Befund

Als Anbieter ist **Google Gemini API** ausgewählt. Der Adapter ruft die
Gemini-Interactions-API direkt per HTTPS auf; es wird kein Vendor-SDK und kein
zusätzliches Gateway benötigt. Der API-Key bleibt serverseitig.

### Was bereits fertig ist

- Adapter-Schnittstelle, Registry und Konfigurationsprüfung
  (`api/_lib/lead-scoring.js`)
- Promptaufbau inklusive Schutz gegen Prompt-Injection
- strikte Antwortvalidierung (`parseScoreResult`)
- Batchlogik mit Fehlerbehandlung, Versuchslimit und Zeitbudget
- monatlicher Cron-Endpunkt (`api/cron-lead-scoring.js`)
- manuelle Wiederholung über das Admin-Panel
- Gemini-Adapter mit JSON-Schema, `store: false` und erneuter lokaler
  Antwortvalidierung
- monatlicher Vercel-Cron am ersten Tag des Monats um 02:00 UTC
- Tests mit austauschbarem Fake-Scorer und gemocktem Gemini-Aufruf — **ohne**
  echte Modellaufrufe

### Noch vor dem Scharfschalten zu erledigen

**a) Gemini-API-Projekt prüfen.** Der Key muss aus einem Google-AI-Studio-
Projekt mit aktivierter kostenpflichtiger API-Abrechnung stammen. Der konkrete
Modellname bleibt konfigurierbar; für den Pilot ist `gemini-2.5-flash` ein
geeigneter Startwert.

**b) Umgebungsvariablen setzen** (mindestens Vercel Production):

| Variable | Beispiel |
|---|---|
| `LEAD_SCORING_PROVIDER` | `gemini` |
| `LEAD_SCORING_MODEL` | z.B. `gemini-2.5-flash` |
| `LEAD_SCORING_API_KEY` | Gemini-API-Schlüssel |

### Verhalten bis dahin

- Ohne diese Variablen antwortet `/api/cron-lead-scoring` weiterhin mit
  `501 lead_scoring_not_configured`. Das ist **kein Ausfall**, sondern der
  sichere deaktivierte Zustand.
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

### Technische Umsetzung

Die vier Sprachfassungen in `src/lib/legalText.js` enthalten jetzt den Zweck
der automatisierten Qualitätsbewertung, Google Gemini als Empfänger, die
USA/Global-Verarbeitung, `store: false` sowie die konkrete 60-Tage-Frist.
`PRIVACY_VERSION` wurde auf `2026-08-25` erhöht. Das löst den bestehenden
Consent-Nachweis-Mechanismus aus.

### Neu zu beschreibende Bearbeitung

| Punkt | Sachverhalt |
|---|---|
| Was | Freitext der Kursanfrage |
| Zweck | automatisierte Qualitätsbewertung (Score 1–10) zur Missbrauchserkennung und zur Steuerung der Anbietersichtbarkeit |
| Wie | serverseitig verschlüsselt gespeichert (AES-256-GCM), monatlich an ein Sprachmodell übermittelt |
| Aufbewahrung | Anfragetext max. **60 Tage**; danach bleibt nur der Score (1–10) ohne Textbezug |
| Ergebnis | **nur** eine Zahl 1–10. Keine Begründung, keine Teilbewertungen, keine Textausschnitte werden gespeichert |
| Empfänger | Google LLC / Google Gemini API |
| Ort | USA/Global; genaue Transfergarantien rechtlich prüfen |

### Rechtliche Prüfung durch den Betreiber

**Ziffer 3, neuer Aufzählungspunkt:**

> • Automatisierte Qualitätsbewertung von Kursanfragen zur Erkennung von Spam
> und Missbrauch sowie zur Steuerung der Sichtbarkeit von Anbietern auf der
> Plattform

**Ziffer 4, neuer Aufzählungspunkt:**

> • Qualitätsbewertung von Anfragen: Google Gemini API (Google LLC, USA/Global). Der Text Ihrer
> Anfrage wird zur automatisierten Bewertung an diesen Dienstleister
> übermittelt. Im bezahlten Gemini-API-Tarif werden Prompts und Antworten gemäss
> Anbieterangaben nicht zur Verbesserung von Google-Produkten verwendet.
> Verarbeitungsort: USA/Global.

**Ziffer 8, Ergänzung:**

> Der Freitext einer Kursanfrage wird verschlüsselt gespeichert und spätestens
> 60 Tage nach Eingang automatisch gelöscht. Erhalten bleibt anschliessend
> lediglich eine Qualitätskennzahl von 1 bis 10 ohne Bezug zum ursprünglichen
> Text sowie die technische Dokumentation der Übermittlung.

### Weitere Prüfpunkte für den Betreiber

- **`PRIVACY_VERSION`** und den Consent-Nachweis prüfen; die neue Version ist
  bereits auf `2026-08-25` gesetzt.
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
