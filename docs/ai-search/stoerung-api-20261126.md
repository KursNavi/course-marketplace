# Störung der öffentlichen Schnittstelle in Produktion (26.11.2026)

Diagnoseprotokoll.
- Alle Erhebungen waren lesend: Nur-Lese-Zugang Produktion und öffentliche Leseproben mit dem
  öffentlichen Website-Schlüssel.
- Das Protokoll enthält keine Nutzerinhalte und keine Zugangsdaten.
- **Eine Störungsursache ist nicht bewiesen.** Die Befunde stehen hier ohne Schlussfolgerung
  auf eine Ursache.

## Zeitlinie (UTC)

| Zeit | Ereignis |
|---|---|
| 20:51 | Merge PR #198 (`a065bd2`). Produktions-Build erfolgreich, das Vorrendern lädt die öffentlichen Kurse fehlerfrei. |
| 21:11:11–21:12:16 | Phase C: KI-Migrationen M1–M7 per Workflow. Sie umfassen unter anderem `CREATE EXTENSION vector`/`unaccent` im Schema `public`, neue Tabellen und Funktionen sowie Trigger auf `courses`, `course_events`, `course_locations` und `profiles`. Gesamtprüfung ok. |
| 21:35:49 | Merge PR #199 (`559b056`, Bereitstellungsprüfung im Produktionswerkzeug). |
| 21:36:53 | Produktions-Build `559b056` scheitert im Vorrendern: PostgREST antwortet 500 mit Code `25P02` („current transaction is aborted …“) beim Laden der öffentlichen Kurse (Rolle anon). Die Website läuft weiter auf `a065bd2`. |
| 21:39–21:52 | Öffentliche Leseproben, nacheinander: mehrfach 500 `25P02`; Laufzeiten bis 60 s. Der Auth-Statusdienst desselben Projekts braucht bis 25 s, das TEST-Projekt antwortet gleichzeitig in rund 0,1 s. |
| 21:54 | Einmalig `NOTIFY pgrst, 'reload schema';` im SQL-Editor (freigegebene begrenzte Massnahme). |
| 21:55 | Erste Probe danach: 503 `PGRST002` („Could not query the database for the schema cache“), danach noch langsam. |
| 21:58–22:12 | Vier Messrunden fehlerfrei, 0,06–1,3 s; keine Rollbacks bei über 600 Transaktionen. |
| 22:09–22:10 | Neubau `559b056` (einmal): erfolgreich, 962 statische Seiten, 701 Kursseiten (identisch mit dem Build vor den Migrationen). |
| vor 22:25:40 | Compute-Grösse im Supabase-Dashboard von **Nano auf Micro** geändert: bis 0,5 GB → 1 GB RAM, angezeigter Stundenpreis unverändert USD 0.01344. Keine weiteren Einstellungen geändert (Angabe PO). |
| 22:25:40 | Datenbank-Neustart (`pg_postmaster_start_time`); alle Schnittstellen-Verbindungen neu. Folge des Grössenwechsels. |
| 22:27 | Kontrolle: Website, Kursdetail und Leseproben 0,04–0,6 s; Auth-Status unter 0,1 s; KI-Stand unverändert (32 Migrationen, 8 Tabellen, 30 Funktionen, `vector` weiterhin in `public`). |

## Befunde vor dem Eingriff

- **Datenbanklast gering:** etwa 3,8 Commits/s, 35 von 60 Verbindungen, keine Sperren auf den
  Kurs- und Profiltabellen, keine langen Transaktionen.
- **Rollbacks:** rund 10 % der Transaktionen (Fenster 21:48–21:51), langjährig 0,33 %.
- **Abgebrochene Sitzungen:** zeitweise eine PostgREST-Sitzung im Zustand
  „idle in transaction (aborted)“.
- **Verzögerung vor der Datenbank:** Während Proben mit 35–60 s Laufzeit war keine PostgREST-
  Sitzung in Postgres aktiv. Die Verzögerung lag also vor der Datenbank, in der
  Schnittstellenschicht bzw. im Projekt.
- **Auch Auth betroffen:** Der Auth-Statusdienst desselben Projekts war ebenfalls langsam; das
  Netz ist laut Vergleich mit TEST nicht die Ursache.
- **Zeitgrenzen der Rollen:** anon 3 s, authenticated 8 s, authenticator 8 s;
  `idle_in_transaction_session_timeout` 0.
- **Öffentliches Schema:** 185 Funktionen, davon 118 aus der Erweiterung `vector`. Die Erweiterung
  ist seit M2 dort; sie fliesst in das Verzeichnis der Schnittstelle ein.
- **Verzeichnisabfragen der Schnittstelle:** 292 Läufe seit Statistikbeginn, Höchstwert 5,6 s;
  das Neuladen um 21:54 lief einmal durch.
- **Keine Schreiblast durch die neuen Trigger:** 0 KI-Aufträge.
- **Supabase-Statusseite:** kein Vorfall für den 26.11.2026 gefunden.

## Nicht einsehbar (über den Nur-Lese-Zugang)

- Logs der Schnittstelle und Postgres-Fehlerlog, also der Ursprungsfehler vor `25P02`.
- CPU, Arbeitsspeicher und Swap der Instanz.

## Offene Hypothesen (keine bewiesen)

1. Ressourcenengpass der kleinen Instanz (Nano, bis 0,5 GB RAM), möglicherweise verstärkt durch
   ein grösseres Schnittstellen-Verzeichnis nach M2. Passend: auch Auth war langsam, und nach dem
   Wechsel auf Micro sind die Werte deutlich besser. Nicht belegt, weil Auslastungsdaten fehlen.
2. Zeitgrenze anon (3 s) wird in der Pipeline der Schnittstelle überschritten; gemeldet wird der
   Folgefehler `25P02` statt des Ursprungsfehlers.
3. Allgemeine Plattformstörung (nicht bestätigt).

## Eingriffe

- `NOTIFY pgrst, 'reload schema';` (einmal, 21:54).
- Ein Neubau des Produktions-Deployments `559b056`.
- Compute-Wechsel Nano → Micro durch den PO, mit Neustart.

Keine Änderungen an Zeitgrenzen, Rechten, Erweiterungen oder Tabellen; kein Beenden fremder
Sitzungen; kein Schemarückbau; keine Supportnachricht.

## Nachkontrollen

- **26.11.2026, 15–30 min nach dem Wechsel:** lesende Kontrollen vor dem begrenzten Start von
  Phase D (Ergebnis im Produktionsbericht).
- **27.11.2026:** lesende Nachkontrolle (keine Voraussetzung für den begrenzten Start).
