# Erwachsenenregel: Migration, Anwendung und Rückweg (zur Prüfung, nicht angewendet)

Stand 27.11.2026. Betrifft `supabase/migrations/20261127120000_account_adult_confirmations.sql`.

**Status:** In keiner Umgebung angewendet, weder TEST noch Produktion.
- Eine Prüfung in TEST innerhalb einer zurückgerollten Transaktion wurde vorbereitet; die
  Ausführung wurde am 27.11.2026 abgelehnt und nicht wiederholt.
- Die Migration ist deshalb bisher nur statisch geprüft (`tests/ai-search-adult-gate.test.jsx`).
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
2. **Produktion:**
   - Der geprüfte Workflow „KI-Suche Produktionsmigrationen“ kennt nur M1–M7, mit Prüfsummen
     und Sollwerten.
   - Für diese Datei gibt es zwei Wege:
     - **(a)** Den Workflow in einem kleinen eigenen PR um M8 erweitern: Prüfsumme, Marker,
       Sollwerte. Das ist die Empfehlung.
     - **(b)** Der PO führt die Datei einmal im SQL-Editor aus und verbucht sie wie die übrigen
       Migrationen.
   - In beiden Fällen ist eine Freigabe nötig.

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
| **RV2** vollständig entfernen | Alle gespeicherten Bestätigungen gehen verloren; die KI-Suche antwortet danach mit 503 (fail closed), bis Code oder Migration zurück sind. Nur mit eigener Freigabe. | `DROP TRIGGER IF EXISTS on_auth_user_adult_confirmation ON auth.users;`<br>`DROP FUNCTION IF EXISTS public.record_signup_adult_confirmation();`<br>`DROP TABLE IF EXISTS public.account_adult_confirmations;` |

- **Code-Rückweg:** Revert des PR. Die Registrierung ohne Häkchen funktioniert dann wieder,
  vorhandene Einträge stören nicht.
- **Reihenfolge bei vollständigem Rückbau:** erst den Code zurücknehmen, dann RV2.
