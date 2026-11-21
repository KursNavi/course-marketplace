# Betriebsrunner KI-Suche (nur TESTumgebung)

Stand 22.11.2026. **Noch kein schreibender Betriebszyklus ausgeführt, kein
Zeitplan aktiv, kein Produktionszugriff.** Code: `src/lib/aiSearch/ops.js`,
`src/lib/aiSearch/opsLease.js`, Aufruf `scripts/ai-search-ops.mjs`
(`npm run ops:ai-test`), Tests `tests/ai-search-ops.test.js`,
Datenbankentwürfe `supabase/drafts/20261122090000_*` und `…090100_*`.

## 1. Ein gemeinsamer Betriebsablauf

| Schritt | Baustein | Schalter | Schreibt (nur über geschützte Funktionen) |
|---|---|---|---|
| Bericht | lesende Abfragen | – (immer) | nichts |
| Index | Abgleich (ohne Kontingent-Cleanup) + Outbox-Worker | `--execute-index` | Jobs einreihen, Index übernehmen + Jobs abschliessen (eine Transaktion), Fehlversuche zählen |
| Embeddings | nur Abschnitte ohne Vektor oder mit anderer Modellversion | `--execute-embed --max-usd=<≤1>` | Vektoren – nur bei unverändertem `content_hash` und aktiver Modellversion; **kostenpflichtig** |
| Bereinigung | abgelaufene Ergebnisse | `--execute-cleanup` | löscht physisch |

Reihenfolge Index → Embeddings → Bereinigung in **einem** Lauf unter **einer**
Sperre. Ein Indexfehler stoppt die folgenden Schritte. Jeder Schreibschritt
braucht seinen Schalter **und** `AI_OPS_CONFIRM=omoapbvfligjfznzivyu`;
Embeddings zusätzlich `AI_SEARCH_MODELS_ENABLED=1` und `OPENAI_API_KEY`.

**Grenzen je Lauf** (Werte darüber werden abgewiesen): Laufzeit ≤ 900 s,
Index ≤ 40 × 50 Jobs, Einreihungen ≤ 500 (gemeinsam für fehlende, verwaiste
Kurse und Hash-Abweichungen), Embeddings ≤ 3000 Abschnitte,
Bereinigung ≤ 5000 Zeilen. **Kosten-Stoppschwellen (keine garantierten
Grenzen):** je Lauf `--max-usd` (≤ USD 1), je Monat USD 2 für die
**erfassten Teilkosten** der Runner-Embeddings (Tokens laut Anbieterantwort ×
Preisannahme, im Laufprotokoll). Würde Schätzung bzw. erfasster Verbrauch die
Schwelle überschreiten, beginnt kein weiterer Aufruf. Ein bereits
gestarteter Aufruf, abweichende Tokenzahlen oder Preise können die
tatsächlichen Kosten darüber hinaus erhöhen; massgeblich ist die
Anbieterabrechnung. Nach der Rückkehr jedes Embedding-Aufrufs werden Abbruch
und Sperrbesitz vor dem Speichern erneut geprüft; die Kosten des bereits
ausgeführten Aufrufs bleiben im Protokoll sichtbar.

Kein Mailversand, kein globaler Kontingent-Cleanup, kein Vercel-Cron
(`vercel.json` behält genau zwei Crons; statischer Test).

## 2. Laufsperre v2 – wie die Sperrlücke geschlossen ist

Bisher: Eine Frist von Laufzeit + 120 s, ohne Verlängerung; ein überlanger
Schritt konnte nach Fristablauf weiterarbeiten, während ein neuer Lauf
startete. Jetzt:

1. **Besitz:** `acquire` legt einen Lauf mit Halterkennung an (Advisory-Lock,
   höchstens ein offener Lauf). Abgelaufene offene Läufe werden dabei als
   `expired` abgeschlossen, mit `taken_over_by` (nachvollziehbare Übernahme).
2. **Kurze Frist + Verlängerung:** Frist 120 s. Vor **jedem** Arbeitsschritt
   (je Kurs, je Embedding-Paket, je Einreihung, Bereinigung) prüft der Runner
   die Restfrist und verlängert. Ein Schritt beginnt nur, wenn die Frist
   danach noch seine längste Dauer plus 10 s Reserve abdeckt
   (Kurs 45 s, Embedding-Paket 50 s, Datenbankanfrage 30 s). Jede
   Datenbankanfrage hat ein festes Zeitlimit von 30 s, der Embedding-Aufruf
   15 s.
3. **Gesamtgrenze:** Verlängerung höchstens bis `max_until` = Laufzeit + 120 s
   (≤ 1800 s). Danach läuft die Sperre ab, auch wenn der Prozess hängt.
4. **Abbruch:** von aussen `ai_search_ops_request_abort(run_id, Grund)` oder
   lokal SIGINT/SIGTERM (z. B. GitHub-Abbruch). Der nächste Schritt startet
   nicht; Abschluss als `aborted`.
5. **Schreibschutz in der Datenbank (Fencing):** Alle Schreibzugriffe des
   Runners laufen über `ai_search_ops_fenced_*`. Jede prüft in derselben
   Transaktion: eigener Halter, offen, Frist gültig, kein Abbruch – und hält
   die Laufzeile mit `FOR SHARE`. Sonst SQLSTATE `KNL01`, nichts geschrieben.
   Eine Übernahme muss auf laufende geschützte Schreibvorgänge warten.
   **Damit kann ein überlanger oder abgelaufener Lauf nichts mehr schreiben
   und nicht mit einem neuen überlappen.**
6. **Abschluss:** `release` nur durch den eigenen Lauf. War die Frist schon
   abgelaufen, wird `expired` protokolliert (gewünschtes Ergebnis in der
   Zusammenfassung); wurde der Lauf bereits übernommen, bleibt `expired`
   stehen und die späte Zusammenfassung wird nachgetragen.
7. **Wiederaufnahme:** Bei Sperrverlust zählt der Runner **keinen**
   Fehlversuch und schreibt nichts mehr; offene Jobs bleiben offen und der
   nächste gültige Lauf erledigt sie (atomare, versionsgeprüfte Übernahme).
   Fehlende Embeddings werden beim nächsten Lauf erneut erkannt.

Exit-Codes: 0 ok · 1 Fehler · 2 Vorbedingung/Schalter fehlt · 3 anderer Lauf
aktiv · 4 Sperre verloren/abgebrochen · 5 kritischer Alarm (`--alarm-exit`).

**Verbleibende, bewusst akzeptierte Grenzen**

- Ein **Embedding-Aufruf**, der bei Sperrverlust schon unterwegs ist, kostet
  trotzdem (höchstens ein Paket ≤ 100 Abschnitte, Grössenordnung Bruchteile
  eines Cents); das Speichern wird abgewiesen, der Verbrauch protokolliert.
- Eine bereits gestartete Datenbankanweisung läuft serverseitig zu Ende, auch
  wenn der Client nach 30 s abbricht. Sie hat den Schreibschutz aber zu
  Beginn bestanden und blockiert eine Übernahme bis zu ihrem Ende – keine
  Überlappung, nur Verzögerung.
- Lesende Schritte (Abgleich, Jobliste, Bericht) sind nicht geschützt; sie
  verändern nichts.
- Die Uhr der Datenbank ist massgeblich; der Runner rechnet mit dem
  gemeldeten Versatz und 10 s Reserve.
- Die zeitgesteuerte Löschung (Abschnitt 3) läuft unabhängig von der
  Sperre; Löschen von Abgelaufenem ist auch parallel unschädlich.

## 3. Aufbewahrung und Löschung

- Gespeicherte Ergebnisse sind **24 h abrufbar** (`expires_at`).
- **Physische Löschung** durch `ai_search_ops_cleanup_tick` (bis 10 × 5000
  Zeilen je Aufruf), eingeplant durch den getrennten Schalter-Entwurf
  `20261122090100`: **stündlich zur Minute 7** als pg_cron-Job in der
  Datenbank (kein Schlüssel, kein Netz, keine Kosten).
- **Maximale verbleibende Aufbewahrung im Normalbetrieb: 25 h** nach
  Erzeugung (24 h Abrufbarkeit + höchstens 60 min bis zum nächsten Lauf +
  Sekunden Laufzeit). Jeder ausgefallene Lauf verlängert um eine Stunde.
- **Überwachung:** Der Bericht zeigt den Löschrückstand (Anzahl, Alter des
  ältesten abgelaufenen Ergebnisses) und die letzte zeitgesteuerte Löschung;
  ab **2 h** Rückstand ist das ein kritischer Alarm.
- Kontolöschung: Ergebnisse werden sofort mitgelöscht (bestehende
  Kaskade). Laufprotokoll: 90 Tage (vom Löschlauf gekürzt).
- Kontingentzeilen (`ai_search_usage`) werden nicht automatisch gelöscht; sie
  sind für die Monatszählung nötig. Ihre Aufbewahrungsfrist wird mit dem
  Produktions-Datenschutzrahmen (Paket 3) festgelegt.

## 4. Betriebsbericht (Trockenlauf)

Abschnitte in Alltagssprache: kritische Alarme und Hinweise; 1. Aktualität
(letzte Indexierung, ältester offener Auftrag, letzter erfolgreicher Lauf je
Schritt); 2. Abdeckung; 3. Aufträge (Anzahl **und** Zahl verschiedener Kurse,
Fehlversuche, fehlgeschlagene mit Fehlertext); 4. Embedding-Lücken;
5. Ergebnisse und Löschrückstand; 6. Betriebsläufe (aktiv, abgelaufen ohne
Abschluss, nicht erfolgreiche der letzten 7 Tage); 7. Kosten.

**Kosten** sind eine **begrenzte Schätzung** (Suchen × angenommener
Höchstpreis + ausstehende Embeddings) plus der **gemessene** Verbrauch der
Runner-Embeddings. Ausdrücklich nicht enthalten: Embedding-Skripte ausserhalb
des Runners, Aufrufe ausserhalb der Kontingenttabelle, andere Kontonutzung,
Preisänderungen. Keine garantierte Obergrenze; massgeblich ist die
Anbieterabrechnung.

Kritische Alarme: fehlgeschlagene Aufträge, ältester offener Auftrag > 24 h,
Löschrückstand > 2 h, abgelaufener nicht abgeschlossener Lauf, nicht
erfolgreicher Lauf in den letzten 24 h.

## 5. Zeitplan und Aktivierung – vorbereitet, AUS

| Teil | Mechanismus | Schalter | Stand |
|---|---|---|---|
| Ergebnislöschung | pg_cron in der TEST-Datenbank, stündlich | Anwendung von `20261122090100` | Entwurf, nicht angewendet |
| Index + Embedding-Deltas + Bereinigung | GitHub-Workflow `ai-ops-cycle.yml`, alle 15 min | Datei auf Standardbranch **und** Repository-Variable `AI_OPS_SCHEDULE_ENABLED=true` | Datei vorbereitet; wirkt auf dem Featurebranch nicht |
| Beaufsichtigter Einzelzyklus | derselbe Workflow, Label `ki-betrieb-zyklus` | Label setzen | vorbereitet |
| Lesender Trockenlauf | `ai-ops-dryrun.yml`, Label `ki-betrieb-trockenlauf` | Label setzen | in Betrieb (lesend) |

Zeitplan-Grenzen je Lauf: 300 s, 6 × 50 Jobs, 200 Einreihungen, 300
Abschnitte, Stoppschwelle USD 0.01 (Schätzung), Bereinigung 1000. Danach lesender Bericht mit
`--alarm-exit`: bei kritischem Alarm wird der Lauf rot und GitHub
benachrichtigt (Zuständig: Repository-Inhaber; Reaktion laut Abschnitt 7).
Vercel-Crons werden nicht verwendet (Kontingent ausgeschöpft, keine
stille dritte Einplanung). Ein GitHub-Zeitplan wirkt nur vom Standardbranch;
vor einem Merge ist daher nur der beaufsichtigte Einzelzyklus möglich.

## 6. Ausführbarer Trockenlauf

```bash
npm run ops:ai-test                 # lesbarer Bericht
npm run ops:ai-test -- --json       # vollständig als JSON
npm run ops:ai-test -- --alarm-exit # Exit 5 bei kritischem Alarm
```

Braucht die TEST-Zugänge (auf diesem Rechner nicht hinterlegt). Über GitHub:
Label `ki-betrieb-trockenlauf` am PR.

## 7. Fehler und Reaktion

| Lage | Wirkung | Reaktion |
|---|---|---|
| Exit 3 (anderer Lauf aktiv) | nichts ausgeführt | nichts; nächster Termin |
| Exit 4 (Sperre verloren/abgebrochen) | kein Fehlversuch gezählt, Rest offen | Bericht prüfen; nächster Lauf übernimmt |
| Exit 1 (Fehler, z. B. Kurs fehlgeschlagen) | Fehlversuch gezählt (ab 5 → `failed`), Folgeschritte gestoppt | Fehlertext im Bericht; Ursache beheben |
| Exit 2 (Vorbedingung, Kosten-Stoppschwelle) | kein Aufruf | Grenze/Konfiguration prüfen, nicht automatisch erhöhen |
| Alarm Löschrückstand | Ergebnisse älter als 26 h vorhanden | pg_cron-Job prüfen (`cron.job_run_details`) |
| Lauf `expired` ohne Abschluss | Absturz | wird beim nächsten Lauf automatisch übernommen |

Keine automatische Wiederholung innerhalb eines Laufs; der nächste
Zeitplan-Termin ist der Wiederanlauf.
