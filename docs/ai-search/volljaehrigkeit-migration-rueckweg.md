# Erwachsenenregel: Migration, Anwendung und Rückweg

Stand 27.11.2026. Betrifft `supabase/migrations/20261127120000_account_adult_confirmations.sql`.

**Status:** In TEST und in **Produktion** angewendet und geprüft (Produktion: 27.11.2026,
16:00 UTC, Workflow-Lauf `46029398326`).

- **Produktion** (27.11.2026), in dieser Reihenfolge:
  1. Merge von PR #204 (`59b28cf`): Code und Rechtstexte live. Bis zur Migration ist kein
     neues Konto entstanden, also kein Konto ohne Nachweis trotz Häkchen.
  2. Merge von PR #205 (`7820f19`): M8 im Workflow „KI-Suche Produktionsmigrationen“.
  3. Plan-Lauf `46027896656`, nur lesend: Prüfsummen der 8 Dateien ok; M1–M7 verbucht (7/8);
     Plan genau `20261127120000 (--single-transaction)`; keine unverbuchten M8-Objekte;
     keine Schreibzugriffe.
  4. Ausführungslauf `46029398326`: Vorprüfungen erneut bestanden, Plan erneut nur M8.
     M1–M7 wurden nicht erneut angewendet. Migration, Verbuchung, Markerprüfung und
     Gesamtprüfung liefen als getrennte Schritte; alle bestanden.
     - Gesamtprüfung: Historie 8, Tabelle 1, RLS an, Trigger 1, 0 Policies, 0 Rechte für
       `anon`/`authenticated` auf Tabelle und Funktion.
     - 0 Einträge für Konten, die vor dem Lauf bestanden; Kurse unverändert 908.
  5. Lesende Nachkontrolle:
     - Verbuchte Prüfsumme genau `ad4d9e9a`, M1–M7 unverändert.
     - Trigger auf `auth.users` aktiv, Funktion `SECURITY DEFINER`, Serverrolle darf
       schreiben.
     - 0 Einträge insgesamt; kein Rückfüllen bestehender Konten.
     - Website erreichbar; `/api/ai-search` weiterhin 404 `not_available` (Phase F gesperrt).
     - Cron-Betrieb danach ok, ohne Problemläufe.

- **Datenbanktest in TEST** (27.11.2026): vom PO im SQL-Editor ausgeführt, als einzelner
  `DO`-Block mit absichtlichem Abbruch, vollständig zurückgerollt. Alle Prüfungen bestanden:
  - Registrierung mit Bestätigung speichert den Nachweis (Quelle `signup`, Version
    `2026-11-27`, Zeitpunkt der Datenbank).
  - Registrierungen ohne neue Metadaten funktionieren weiter, ohne Nachweis.
  - Ein simulierter Schreibfehler verhindert die Kontoerstellung.
  - 0 Einträge für die 6 bestehenden Konten.
  - RLS an, keine Policy, keine Rechte für `anon`/`authenticated`; der Server darf schreiben.
  - Bestätigung über den Serverweg (`ai_search`); Löschung mit dem Konto.

  Lesende Nachkontrolle danach: keine Objekte und keine Testkonten zurückgeblieben.
- **Anwendung in TEST** (27.11.2026): vom PO im SQL-Editor; Migration und Verbuchung unter
  `20261127120000` in einer Transaktion.
  - Lesende Nachkontrolle: Tabelle, Funktion und Trigger vorhanden; RLS an; 0 Policies; 0 Rechte
    für `anon`/`authenticated`; 0 Einträge für die bestehenden Konten.
  - Die verbuchte Prüfsumme lautet `0f3daf97`, weil beim Kopieren aus dem Chat
    Windows-Zeilenumbrüche entstanden sind. Ohne sie ist sie exakt `ad4d9e9a`; der Inhalt ist
    identisch und funktional ohne Unterschied.
- **Vorschau von PR #204** (`79f0aac`), ohne Modellaufrufe, denn für diesen Branch ist kein
  OpenAI-Zugang gesetzt:
  - Eine Registrierung ohne 18+-Häkchen ist blockiert. Mit Häkchen: ein neues Konto mit genau
    einem Nachweis `signup`.
  - Ein bestehendes Konto sieht in der KI-Suche die Abfrage statt des Formulars. Nach der
    Bestätigung entsteht genau ein Nachweis `ai_search`, und das Formular erscheint.
  - Keine Suche und kein Kontingentverbrauch; lesend in TEST bestätigt.
- Supabase ist nicht mit GitHub verbunden. Ein Merge wendet die Datei **nicht** automatisch an.

## Was die Migration tut

| Objekt | Zweck |
|---|---|
| Tabelle `public.account_adult_confirmations` | Selbstauskunft „mindestens 18 Jahre“ je Konto und Regelversion (`rule_version`), mit Quelle (`signup` oder `ai_search`) und Zeitpunkt der Datenbank (`confirmed_at`). Löschung mit dem Konto (`ON DELETE CASCADE`). |
| RLS an, `REVOKE ALL` für `anon` und `authenticated`, keine Policy | Nur die Serverrolle liest und schreibt. |
| Funktion `public.record_signup_adult_confirmation()` und Trigger `on_auth_user_adult_confirmation` (`AFTER INSERT ON auth.users`) | Schreibt den Eintrag bei der Registrierung in derselben Transaktion wie das Konto. Bedingung: Die Metadaten enthalten `adult_confirmed = true` und eine Regelversion im Format `JJJJ-MM-TT`. Scheitert das Schreiben, entsteht kein Konto. |

**Bewusst nicht enthalten:**
- **Kein Rückfüllen** bestehender Konten. Weder frühere Registrierung noch alte AGB-Zustimmung
  zählen als Bestätigung.
- Keine Änderung bestehender Tabellen oder Funktionen.
- Kein Geburtsdatum, kein Ausweis, kein Elternverfahren.

Ohne Häkchen gibt es keine Registrierung über die Oberfläche. Ein direkt über die
Auth-Schnittstelle angelegtes Konto ohne Angabe erhält keinen Eintrag. Für die KI-Suche ist es
gesperrt, bis die Bestätigung nachgeholt ist.

## Verhalten je Zustand (Code im PR)

| Zustand | Registrierung | KI-Suche |
|---|---|---|
| Migration angewendet, neue Registrierung mit Häkchen | Eintrag `signup` atomar mit dem Konto | frei |
| Bestehendes Konto (vor der Regel) | – | einmalige Abfrage, dann Eintrag `ai_search` (gespeichert und zurückgelesen) |
| Bestätigung abgelehnt oder fehlend | Oberfläche verhindert die Registrierung | 400, kein Schreibzugriff, bleibt gesperrt |
| Speicherung fehlgeschlagen | Registrierung schlägt fehl (Trigger) | 503 `adult_confirmation_not_saved`, bleibt gesperrt |
| Direkter API-Aufruf ohne Eintrag | – | 403 `adult_confirmation_required`; kein Kontingent, kein Modell |
| Migration (noch) nicht angewendet | Registrierung funktioniert, es entsteht kein Eintrag | 503 `adult_check_unavailable` (fail closed) |

## Anwendung (eigene Freigabe)

Empfohlene Reihenfolge: **zuerst die Migration, dann der Merge.** Die Migration legt nur neue
Objekte an, und der Trigger tut ohne Metadaten nichts; der heutige Code bleibt davon
unberührt. So wird jede Registrierung ab dem Merge gespeichert.

1. **TEST**, für die Vorschau der KI-Suche:
   - Anwendung über `apply_migration` mit derselben Datei.
   - Prüfungen: Abschnitt „Kontrolle“ unten, dazu eine Test-Registrierung über die Vorschau.
2. **Produktion** über den geprüften Workflow „KI-Suche Produktionsmigrationen“, erweitert um
   M8 (PR #205). Tatsächlich ausgeführt nach dem Merge von #204, siehe Status oben:
   - **Feste Prüfsumme** der Datei: md5 beginnt mit `ad4d9e9a`. Jede Abweichung stoppt vor
     jedem Datenbankzugriff.
   - **Plan (lesend, Standard):** Ziel nur Produktion, Ausgangslage, fehlende Versionen. Mit
     verbuchten M1–M7 ist der Plan genau `20261127120000 (--single-transaction)`.
     - Verbuchte Migrationen werden nie erneut ausgeführt.
     - Eine Lücke in der Reihenfolge stoppt.
     - Existieren die Objekte von M8 bereits, ohne verbucht zu sein, stoppt der Plan statt
       doppelt auszuführen.
   - **Ausführung** nur mit `modus=ausfuehren` und Freigabe der Umgebung
     `ki-produktion-migration`:
     - Anwendung mit `--single-transaction` und `ON_ERROR_STOP`;
     - Verbuchung in `supabase_migrations.schema_migrations` (Version, Name, Dateiinhalt);
     - Prüfung des Markers: Tabelle und Trigger vorhanden.
   - **Nachkontrolle** (Gesamtprüfung, Sollwerte):
     - M1–M7 unverändert, Historie 8;
     - Tabelle 1, RLS an, Trigger 1, keine Policy;
     - 0 Rechte für `anon`/`authenticated` auf Tabelle und Triggerfunktion;
     - **0 Einträge für Konten, die vor dem Lauf bestanden** (kein Rückfüllen);
     - Kurszahl unverändert.

     Eine Abweichung stoppt. Dann wird der verbliebene Stand lesend festgestellt; ein
     Rückweg nur mit eigener Freigabe.

## Kontrolle (lesend, nach der Anwendung)

```sql
select to_regclass('public.account_adult_confirmations') is not null as tabelle,
       exists (select 1 from pg_trigger where tgname = 'on_auth_user_adult_confirmation') as trigger,
       has_table_privilege('anon', 'public.account_adult_confirmations', 'SELECT') as anon_lesbar,        -- Soll: false
       has_table_privilege('authenticated', 'public.account_adult_confirmations', 'INSERT') as auth_schreibbar, -- Soll: false
       (select count(*) from public.account_adult_confirmations) as eintraege;                              -- Soll direkt danach: 0
```

## Rückweg

| Stufe | Wirkung | SQL |
|---|---|---|
| **RV1** Trigger aus | Neue Registrierungen speichern keine Bestätigung mehr; neue Konten werden vor der KI-Suche gefragt. Vorhandene Einträge bleiben. | `DROP TRIGGER IF EXISTS on_auth_user_adult_confirmation ON auth.users;` |
| **RV2** vollständig entfernen | Alle gespeicherten Bestätigungen gehen verloren; die KI-Suche antwortet danach mit 503 (fail closed), bis Code oder Migration zurück sind. Nur mit eigener Freigabe. | `DROP TRIGGER IF EXISTS on_auth_user_adult_confirmation ON auth.users;`<br>`DROP FUNCTION IF EXISTS public.record_signup_adult_confirmation();`<br>`DROP TABLE IF EXISTS public.account_adult_confirmations;`<br>In Produktion zusätzlich die Verbuchung entfernen, damit der Workflow M8 später wieder planen kann: `DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261127120000';` |

- **Code-Rückweg:** Revert des PR. Die Registrierung ohne Häkchen funktioniert dann wieder,
  vorhandene Einträge stören nicht.
- **Reihenfolge bei vollständigem Rückbau:** erst den Code zurücknehmen, dann RV2.
