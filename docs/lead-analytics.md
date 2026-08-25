# Lead-Analyse — Phase 1

Technische Dokumentation zu Datenfluss, Aufbewahrung, KI-Bewertung, Paketverlauf
und Ranking-Penalty.

Verwandte Dokumente:

- `docs/review/lead-scoring-open-decisions.md` — offene Entscheidungen, die vor
  der Produktivsetzung getroffen werden müssen (KI-Anbieter, Datenschutztext).

---

## 1. Überblick

Eine Kursanfrage (`booking_type = 'lead'`) erzeugt ab dieser Phase drei Dinge:

1. eine E-Mail an den Anbieter mit getrenntem Versand-/Zustellstatus,
2. einen **dauerhaften** Lead-Datensatz in `leads` (Statistik),
3. einen **verschlüsselten, auf 60 Tage befristeten** Anfragetext in
   `lead_message_payloads`.

Ein monatlicher Batchlauf bewertet den Anfragetext per KI mit einem Score von
1–10. Aus diesen Scores ergibt sich ein Ranking-Abschlag für Basic-Anbieter, die
bereits genügend qualifizierte Anfragen erhalten haben.

---

## 2. Datenfluss einer Anfrage

```
Browser (DetailView)
   │  POST /api/send-lead  { courseId, name, email, message }
   ▼
api/send-lead.js
   │  1. Kurs laden, booking_type prüfen
   │  2. Anbieter-E-Mail + package_tier laden
   │  3. E-Mail-Hash bilden (LEAD_HASH_SALT), 5-Minuten-Rate-Limit prüfen
   │  4. INSERT leads   ← OBLIGATORISCH, Abbruch bei Fehler
   │  5. INSERT lead_message_payloads (verschlüsselt, expires_at = +60 Tage)
   │  6. E-Mail versenden → leads.status = 'sent' | 'failed'
   │     email_delivery_status = 'accepted' | 'failed'
   ▼
Antwort an den Browser → trackContactLead()
```

### Warum Schritt 4 abbricht

Vorher wurde ein Fehler beim Lead-Insert nur protokolliert und die E-Mail
trotzdem versendet. Dabei entstand eine **versandte, aber nirgends erfasste**
Anfrage — die Leadstatistik und damit die Ranking-Penalty wären lückenhaft.
Jetzt gilt: kein Lead-Datensatz, keine E-Mail.

### Warum Schritt 5 NICHT abbricht

Der Anfragetext ist nur die Grundlage der späteren KI-Bewertung, nicht der
Anfrage selbst. Schlägt das Speichern fehl (z.B. fehlender
`LEAD_MESSAGE_ENCRYPTION_KEY`), wird der Lead mit
`quality_error_code = 'payload_write_failed'` markiert und die E-Mail geht
trotzdem raus. Der Retention-Lauf setzt den Lead später auf
`expired_unscored`.

---

### E-Mail-Status

`leads` bleibt die Quelle für die Leadstatistik. `leads.status = 'sent'` bedeutet
nur, dass Resend die Anfrage ohne API-Fehler angenommen hat; daraus folgt noch
keine Zustellung ins Postfach. Der Admin-Bereich zeigt deshalb zusätzlich
`email_delivery_status`:

| Status | Bedeutung |
|---|---|
| `unknown` | historischer Lead ohne nachverfolgbaren Versandstatus |
| `pending` | Lead angelegt, Versand noch nicht abgeschlossen |
| `accepted` | Resend hat die E-Mail angenommen |
| `delivered` | Resend meldet Zustellung an den Empfänger-Mailserver |
| `delivery_delayed` | vorübergehende Zustellverzögerung |
| `bounced` / `failed` / `suppressed` | Zustellung oder Versand fehlgeschlagen |
| `complained` | Empfänger hat die Nachricht als Spam gemeldet |

Die Resend-Webhooks werden über `/api/resend-webhook` signaturgeprüft. Resend
liefert dafür Ereignisse wie `email.delivered`, `email.bounced` und
`email.delivery_delayed`; die Signatur muss aus dem unveränderten Request-Body
geprüft werden. Dafür braucht Vercel zusätzlich `RESEND_WEBHOOK_SECRET`. Der
Webhook wird in Resend auf
`https://kursnavi.ch/api/resend-webhook` mit diesen Ereignissen registriert:

`email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`,
`email.complained`, `email.failed`, `email.suppressed`.

---

## 3. Aufbewahrung (Retention)

| Datum | Frist | Wer räumt auf |
|---|---|---|
| `leads` (Statistik) | **unbegrenzt** | niemand |
| `lead_message_payloads.ciphertext` | 60 Tage | `cleanup_expired_lead_messages()` |
| `leads.requester_email_hash` | 60 Tage → `NULL` | `cleanup_expired_lead_messages()` |
| Alles beim Kontolöschen | sofort | `delete_provider_account()` → Kaskade |

Der tägliche `/api/cron` ruft `cleanup_expired_lead_messages()` auf.

**Geändert gegenüber vorher:** `cleanup_old_leads()` löschte Lead-Datensätze nach
180 Tagen komplett. Die Funktion existiert noch, ist aber wirkungslos — sie ist
nur eine Kompatibilitätshülle für den Fall, dass die Migration vor dem
Code-Deploy eingespielt wird. Nach dem Deploy kann sie entfernt werden.

### E-Mail-Hash

Das Rate-Limiting in `api/send-lead.js` schaut **5 Minuten** zurück. Der Hash
wird trotzdem 60 Tage vorgehalten (Missbrauchsprävention) und danach geleert.
Das Rate-Limiting bleibt davon unberührt.

### Kurslöschung

`leads.course_id` ist jetzt nullable mit `ON DELETE SET NULL` statt
`ON DELETE CASCADE`. Wird ein Kurs gelöscht, bleibt der Lead in der Statistik
des Anbieters; nur die Kurszuordnung entfällt. Das Admin-Panel zeigt an dieser
Stelle „Kurs gelöscht".

---

## 4. Verschlüsselung des Anfragetextes

- **Verfahren:** AES-256-GCM (`api/_lib/lead-message-crypto.js`)
- **Speicherformat:** `v1.<iv>.<authTag>.<ciphertext>`, alle Teile base64url
- **Schlüssel:** `LEAD_MESSAGE_ENCRYPTION_KEY`, base64 von exakt 32 Bytes

Schlüssel erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Regeln:

- Nur als Server-Environment-Variable setzen. **Nie** mit `VITE_` präfixen —
  solche Variablen landen im Browser-Bundle.
- Nie ins Repository, in Tests oder in Logs.
- Der Klartext erscheint in keinem Serverlog. Fehlermeldungen enthalten nur
  Lead-IDs und Fehlercodes.

**Rotation:** Das `v1.`-Präfix erlaubt ein zweites Verfahren parallel. Für einen
reinen Schlüsselwechsel müssten bestehende Payloads einmalig serverseitig
umgeschlüsselt werden — oder man wartet 60 Tage, bis alle abgelaufen sind.

Zugriff auf `lead_message_payloads`:

- RLS aktiv, **keine einzige Policy** → kein Zugriff für `anon`/`authenticated`
- zusätzlich `REVOKE ALL ... FROM anon, authenticated`
- entschlüsselt wird ausschliesslich in `api/admin-lead-analytics.js`
  (`action=message`) und im Scoring-Batch

---

## 5. KI-Bewertung

### Rubrik

| Score | Bedeutung |
|---|---|
| 1–2 | Spam, Werbung, Unsinn oder praktisch unbrauchbar |
| 3–4 | sehr vage, kaum kursbezogen oder nicht sinnvoll bearbeitbar |
| 5–6 | echte und grundsätzlich relevante Kursanfrage |
| 7–8 | konkrete, gut bearbeitbare Anfrage mit erkennbarem Interesse |
| 9–10 | sehr konkretes Teilnahmeinteresse bzw. starke Handlungsabsicht |

Ab **Score ≥ 5** gilt ein Lead als *qualifiziert* (Ranking-Penalty).

Das Modell gibt **ausschliesslich** `{"score": <1-10>}` zurück. Keine
Begründung, keine Teilbewertungen — beides würde dauerhaft gespeicherte
Freitexte über Anfragende erzeugen.

### Ablauf

`/api/cron-lead-scoring` ist als geschützter Ausführungspunkt eingerichtet und
läuft am ersten Tag jedes Monats um 02:00 UTC. Bis die Gemini-Konfiguration und
die rechtliche Freigabe vorliegen, bleibt der Lauf sicher deaktiviert.

1. Leads mit `quality_status IN ('pending','failed')` und
   `quality_attempts < 3` laden, deren Anfragetext noch existiert
2. Kurskontext für alle Leads in **einer** Abfrage nachladen
3. pro Lead: entschlüsseln → Modell fragen → Antwort validieren
4. Erfolg: `quality_score`, `quality_status='scored'`, `quality_scored_at`,
   `quality_score_version`
5. Fehler: `quality_status='failed'`, `quality_attempts+1`,
   `quality_error_code` — der Lead bleibt unbeschädigt
6. anschliessend `recompute_basic_lead_ranking_factors()`

### Sicherheit gegen Prompt-Injection

Der Anfragetext ist **nicht vertrauenswürdig**. Drei Schichten:

1. Er steht in einem markierten Block `--- BEGINN ANFRAGE ---`, ausdrücklich als
   Daten deklariert.
2. Die Systemanweisung verlangt, Anweisungen innerhalb des Blocks zu ignorieren.
3. **Entscheidend:** `parseScoreResult()` akzeptiert ausschliesslich ein Objekt
   mit einer ganzen Zahl 1–10 in `score`. Selbst eine erfolgreiche Injection
   kann damit nur einen ungültigen und folglich verworfenen Wert erzeugen.

### Grenzen

| Grenze | Wert | Wo |
|---|---|---|
| Textlänge | 5 000 Zeichen | `MAX_MESSAGE_LENGTH` |
| Batchgrösse | 50 (max. 500) | `DEFAULT_BATCH_SIZE` / `MAX_BATCH_SIZE` |
| Versuche pro Lead | 3 | `MAX_SCORING_ATTEMPTS` |
| Zeit pro Bewertung | 20 s | `SCORER_TIMEOUT_MS` |
| Manuelle Wiederholung | 25 Leads | `RESCORE_MAX_IDS` |

### KI-Anbieter — Gemini

Der produktive Adapter `gemini` ruft die Gemini-Interactions-API direkt per
HTTPS auf. Die Antwort wird durch ein JSON-Schema und zusätzlich lokal auf eine
ganze Zahl von 1–10 geprüft; es wird nur dieser Score gespeichert. Die
Interaktion wird mit `store: false` angefordert. Zu setzen sind:
`LEAD_SCORING_PROVIDER=gemini`, `LEAD_SCORING_MODEL` und
`LEAD_SCORING_API_KEY`. Details und die verbleibende rechtliche Checkliste
stehen in `docs/review/lead-scoring-open-decisions.md` sowie
`docs/review/lead-scoring-gemini-setup.md`.

Bis dahin antwortet der Endpunkt mit `501 lead_scoring_not_configured`. Leads
sammeln sich als `pending` und werden nachbewertet, sobald die Konfiguration
steht. **Der E-Mail-Versand ist davon nie betroffen.**

---

## 6. Paketverlauf

`profiles.package_tier` kennt nur den Ist-Zustand. Der Verlauf steht in
`provider_package_history`:

| Spalte | Bedeutung |
|---|---|
| `package_tier` | basic / pro / premium / enterprise |
| `started_at` / `ended_at` | Periode; `ended_at IS NULL` = laufend |
| `start_is_estimated` | `true` bei Zeilen aus dem Backfill |
| `change_source` | `db_trigger` oder `backfill` |

**Zentral über einen DB-Trigger**, nicht im Anwendungscode: `package_tier` wird
an mindestens vier Stellen geändert (`api/admin.js` set-tier,
`api/confirm-package-checkout.js`, `api/webhook.js`, `api/cron.js` Ablauf und
Aktivierung). Der Trigger auf `profiles` greift unabhängig davon, wer schreibt —
kein Änderungspfad kann vergessen werden.

Ein Unique-Index (`ended_at IS NULL`) garantiert **höchstens eine offene Periode
pro Anbieter**.

`profiles.package_started_at` spiegelt den Beginn der offenen Periode für
performante Massenabfragen.

### Backfill

Vergangene Wechsel sind nirgends protokolliert und werden **nicht erfunden**.
Jeder bestehende Anbieter bekommt eine offene Zeile mit seinem heutigen Paket
und `started_at = profiles.created_at`, markiert als
`start_is_estimated = true`. Das Admin-Panel zeigt „(bekannt seit)".

Für die Ranking-Penalty ist das unkritisch: Sie zählt nur Leads mit
`provider_tier_at_lead = 'basic'`, und dieses Feld existiert erst ab dieser
Migration. Alle Altleads tragen `NULL` und können keiner Basic-Phase
zugeschlagen werden.

### Nicht umgesetzt

Eine **fachliche** Änderungsquelle (Stripe / Admin / Cron) ist im Trigger nicht
zuverlässig ermittelbar: Alle Pfade schreiben mit derselben `service_role`, und
`supabase-js` kann pro Statement kein `set_config` setzen. Ein geratener Wert
wäre schlechter als keiner — deshalb bleibt es bei der technischen Quelle.

---

## 7. Ranking-Penalty für Basic-Anbieter

### Staffel

| Qualifizierte Basic-Leads | Faktor |
|---|---|
| 0–3 | 1.00 |
| 4–6 | 0.90 |
| 7–10 | 0.80 |
| ab 11 | 0.70 |

Pro, Premium und Enterprise haben **immer** 1.00.

### Zählregel

Ein Lead zählt nur, wenn **alle** Bedingungen erfüllt sind:

- `status = 'sent'`
- `quality_score >= 5`
- `provider_tier_at_lead = 'basic'`
- `created_at >= Beginn der AKTUELLEN Basic-Phase`

Daraus folgt automatisch:

- Leads aus Pro-/Premium-/Enterprise-Zeiten zählen nie.
- Leads aus **früheren** Basic-Phasen zählen nie.
- Noch nicht bewertete Leads zählen (vorerst) nicht.
- Altleads ohne Paket-Snapshot zählen nie.

### Wo der Faktor lebt

`profiles.basic_lead_ranking_factor` (NUMERIC(3,2)).

Berechnet von `recompute_basic_lead_ranking_factors()` — mengenbasiert, ein
einziges `UPDATE`, keine Schleife. Läuft nach jedem Scoringlauf.

**Sofortiges Zurücksetzen:** Ein Trigger setzt den Faktor bei jedem echten
Paketwechsel im selben Schreibvorgang auf 1.00. Wer ein Bezahlpaket kauft, ist
also sofort entlastet und muss nicht auf den nächsten Monatslauf warten. Eine
neu beginnende Basic-Phase startet ebenso bei 1.00.

### Warum am Profil und nicht in einer eigenen Tabelle

`App.jsx → fetchCourses()` lädt die Anbieterprofile ohnehin schon in **einer**
Abfrage (`.in('id', userIds)`). Der Faktor reist dort mit. Die öffentlichen
Kurslisten stellen dadurch **keine einzige** zusätzliche Abfrage — weder pro
Kurs noch pro Anbieter. Kein N+1.

Bewusst liegt dort **nur der Faktor**, nicht die Leadzahl: `profiles` ist über
die Policy „Anyone can read profiles" öffentlich lesbar. Der Faktor ist eine
grobe Vierer-Stufe und fürs Ranking im Browser unvermeidbar; die genaue Anzahl
qualifizierter Leads bleibt der Admin-API vorbehalten.

### Wirkung im Ranking

Zentral in `src/lib/basicLeadPenalty.js`. Beide öffentlichen Rankingpfade nutzen
es:

| Pfad | Datei | Formel |
|---|---|---|
| Suche / Kursliste | `src/lib/searchRelevance.js` | `(Prio × Booking + Jitter) × Faktor` |
| Ähnliche Kurse | `src/lib/courseRecommendations.js` | `Score × Faktor` (nur bei Score > 0) |

Serverseitig wird nirgends nach Ranking sortiert — geprüft für `api/`.

Zwei Eigenschaften bleiben garantiert:

- Die Penalty **filtert nichts**. Die Treffermenge und die angezeigte
  Trefferanzahl bleiben identisch.
- Sie wirkt **nach** der Relevanzstufe. Ein fachlich oder regional unpassender
  Kurs kann dadurch nicht nach vorne rutschen.

Bei `courseRecommendations.js` wird nur ein **positiver** Score multipliziert:
Dieser Score ist additiv und kann negativ werden; ein Faktor < 1 würde einen
negativen Score zur Null hin verschieben und den abgestuften Anbieter
ausgerechnet belohnen.

---

## 8. Admin-API

`/api/admin-lead-analytics` — dieselbe Admin-Prüfung wie `/api/admin`
(Bearer-Token → Supabase Auth → `profiles.role === 'admin'`), gebündelt in
`api/_lib/admin-auth.js`.

| Action | Methode | Zweck |
|---|---|---|
| `overview` | GET | Anbieterübersicht, paginiert/gefiltert/sortiert |
| `detail` | GET | Kennzahlen, Monatsverlauf, Paketverlauf |
| `leads` | GET | Einzelleads, **ohne** Klartext |
| `message` | GET | Klartext **eines** Leads |
| `rescore` | POST | manuelle Wiederholung der Bewertung |

Sicherheitsregeln:

- Kein Service-Role-Schlüssel im Client.
- Listen-Endpunkte liefern **nie** Klartext. Entschlüsselt wird ausschliesslich
  in `action=message`, also beim gezielten Öffnen eines einzelnen Leads.
- IDs (UUID-Format), Pagination, Sortierung und Filter werden serverseitig
  **doppelt** validiert: in der API gegen Allowlists und nochmals in den
  SQL-Funktionen.
- Sortierparameter werden über `CASE`-Ausdrücke aufgelöst, nicht über
  dynamisches SQL — keine Injection über `sortBy`.
- Alle Auswertungs-Funktionen sind `SECURITY DEFINER` mit
  `REVOKE ... FROM anon, authenticated` und `GRANT ... TO service_role`.

Abfragegrenzen: Übersicht max. 100 Zeilen/Seite, Leads max. 100, Rescore max. 25.

---

## 9. Migrationen

Reihenfolge beachten — sie bauen aufeinander auf:

1. `20260824_lead_quality_extend_leads.sql`
2. `20260824_lead_message_payloads.sql`
3. `20260824_provider_package_history.sql`
4. `20260824_basic_lead_ranking_factor.sql`
5. `20260824_admin_lead_analytics_rpc.sql`
6. `20260824_lead_email_delivery_status.sql`

---

## 10. Umgebungsvariablen

| Variable | Pflicht | Zweck |
|---|---|---|
| `LEAD_MESSAGE_ENCRYPTION_KEY` | für Bewertung | AES-256-GCM-Schlüssel, base64(32 Byte) |
| `CRON_SECRET` | für Scoring-Cron | schützt `/api/cron-lead-scoring` |
| `RESEND_WEBHOOK_SECRET` | für E-Mail-Zustellung | signaturprüft `/api/resend-webhook` |
| `LEAD_SCORING_PROVIDER` | **offen** | Adaptername |
| `LEAD_SCORING_MODEL` | **offen** | Modellbezeichnung |
| `LEAD_SCORING_API_KEY` | **offen** | Schlüssel des Anbieters |

`LEAD_HASH_SALT` und `SUPABASE_SERVICE_ROLE_KEY` bestehen unverändert weiter.
