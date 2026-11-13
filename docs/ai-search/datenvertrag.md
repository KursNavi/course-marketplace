# KI-Suche: Datenvertrag (Phase 1, S01/S02 – Entwurf zur Abnahme)

Stand 13.11.2026. Dieser Vertrag definiert, welche Daten die katalogweite KI-Suche sehen
darf, wie Status, Preis und Termine zu deuten sind und welche Invarianten jede Stufe
(Index, Suchschnittstelle, Zwischenspeicher, Ausgabe) einhalten muss. Grundlage ist das
Phase-0-Inventar (`planung/.../umsetzung/phase0-inventar.md`); Bestandszahlen daraus sind
vorläufig, der Vertrag selbst ist unabhängig von der Kataloggrösse gültig.

## 1. Publikationsregel (serverseitig, auf jeder Stufe)

- **Öffentlich durchsuchbar ist ausschliesslich `courses.status = 'published'`.**
- Die RLS der Kerntabellen erzwingt das seit Migration `20260911120000` bewusst
  **nicht** mehr (Direkt-URL-Vorschau, `USING (true)`). Deshalb gilt: Projektion,
  Index, Such-API, Cache und die Prüfung unmittelbar vor Ausgabe setzen die Regel
  **jeweils selbst** durch. Entwürfe gelangen weder in den öffentlichen Index noch als
  Kontext an ein Modell.
- `status IS NULL` (Legacy) wird **nicht** als veröffentlicht behandelt, solange kein
  Nachweis am aktuellen Bestand existiert, dass solche Zeilen vorkommen und öffentlich
  sein sollen. Der tägliche Soll-Ist-Abgleich zählt NULL-Zeilen separat und alarmiert,
  falls welche auftauchen (dann bewusste Entscheidung, kein stiller Default).
- Bestehende Vorschauzugriffe per Direkt-URL bleiben unverändert; dieser Vertrag ändert
  keine RLS-Policies.
- Rücknahme (published→draft/delete) hat Vorrang: Der Ausgabepfad prüft den Status
  unmittelbar vor Auslieferung gegen die Quelle; ein veralteter Index-/Cacheeintrag
  darf nie allein zur Ausgabe führen.

## 2. Erlaubte Felder der öffentlichen Suchprojektion

Aus `courses` (Quelle: öffentliche Kursdetailseite; nur Felder, die dort angezeigt werden):

| Feld | Verwendung |
|---|---|
| `id`, `title`, `description`, `objectives`, `prerequisites`, `keywords`, `free_reason` | Volltext (bereinigt, gechunkt) |
| `level`, `language`/`languages`, `delivery_type(s)`, `target_age_groups`, `min_age`, `target_group`, `session_count`, `session_length` | strukturierte Kriterien |
| `price`, `price_info`, `booking_type` | abgeleiteter Preisstatus (§3) |
| `canton`, `address`, `course_locations.*` (city/canton/street/location_type) | Ort |
| Kategoriepfade (`v_course_full_categories` bzw. Zuordnungstabellen) | Thema/Segment |
| `is_prio`, `plan_tier`-Ableitung | **nur** Paid-Stufe nach fachlicher Bewertung, nie als Modell-Evidenz |
| `user_id` → `profiles`: `slug`, `city`, `canton`, `verification_status`, `bio_text` | zulässige öffentliche Anbieterangaben |

**Ausgeschlossen (nie in Projektion, Index oder Modellkontext):** `courses.contact_email`,
sämtliche Lead-/Anfrageinhalte und -scores, `basic_lead_ranking_factor`, `booking_factor`,
private Profilfelder (E-Mail, Auszahlungs-/Stripe-Daten), Paketpreise/-historie,
nicht-öffentliche Admin-Felder. Paketstufe/`is_prio` fliessen ausschliesslich in die
serverseitige Paid-Stufe (nach Bewertung) ein.

## 3. Preisstatus (abgeleitet, keine Datenmigration)

Abgeleitet pro Kurs aus `booking_type` + `price` + `price_info`
(Implementierung: `src/lib/aiSearch/priceStatus.js`, gespiegelt an
`src/lib/formatPrice.js`, ohne dessen Anzeige-Logik zu verändern):

| Eingang | Status | Budget-Muss |
|---|---|---|
| `lead` + `price` 0/null/leer | `unknown` („Preis auf Anfrage“) | **nicht erfüllt** (nie „bestätigt“) |
| `platform`/`platform_flex` + 0/null | `free` (echtes Gratis) | erfüllt jedes Budget |
| `price > 0` | `fixed` (CHF, Gesamtpreis-Annahme; Einheit unbestätigt → §5 Datenlücke) | deterministisch vergleichbar |
| `price_info` vorhanden (Freitext) | `info_text`; für Muss wie `unknown`, Text wird als Datenlücke angezeigt | **nicht erfüllt** |

„Gratis“, „auf Anfrage“, „ab“, „pro Einheit“ und Zusatzkosten sind unterscheidbare
Zustände; heute existiert im Schema keine explizite Preisart — `fixed` trägt deshalb die
Kennzeichnung `basis: 'unbestätigt'`, bis P02 die Preisbasis als Feld einführt. Keine
pauschale Nullwertmigration; bestehende Speicherzustände bleiben unverändert.

## 4. Event-/Terminvertrag

- Events (`course_events`) tragen Ort (`canton`, `location`), Zeitraum
  (`start_date`, `end_date`), Kapazität und Absage (`cancelled_at`, `cancelled_reason`).
  **Events haben kein eigenes Preisfeld** (am Code und Snapshot verifiziert): Der
  Kurspreis gilt für alle Events.
- Eventbezogene Muss-Kriterien (Ort, Zeitraum, nicht abgesagt, nicht vergangen) muss
  **ein und derselbe** Event erfüllen. Ort aus Event A plus Datum aus Event B ist kein
  Treffer. Mehrtägige Events: Überlappungsregel Zeitraum ∩ [start, end] ≠ ∅.
- Zeitzone: Europe/Zurich; Datumsvergleiche auf Tagesebene in dieser Zone.
- Vergangene und abgesagte Events erfüllen nichts und werden nie als „nächster Termin“
  ausgegeben.
- Kurse ohne Event können eventbezogene Muss-Kriterien nicht bestätigen → Bereich
  „Angaben unvollständig“ (laut Snapshot betrifft das die Mehrheit des Bestands;
  endgültige Quote nach E1).
- „Online“ zählt nur als Ortstreffer, wenn die Suchperson Online erlaubt hat.

## 5. Datenlücken und Unbekannt-Zustände

Jedes Faktenfeld der Ausgabe trägt einen von drei Zuständen: `belegt` (mit Quelle:
Feld-/Eventreferenz), `unbekannt`, `nicht zutreffend`. Unbekannt erfüllt kein Muss,
wird bei Wunschkriterien als Lücke angezeigt und nie durch Modelltext aufgefüllt.
Quelle und Prüfzeitpunkt gehören zum einzelnen Feld (P02); bis P02 implementiert ist,
trägt jedes Feld mindestens die Quellreferenz (Tabelle.Spalte bzw. Event-ID) und die
`source_updated_at`-Version der Projektion.

## 6. Versionierung und Frische

- Jeder Projektions-/Chunkeintrag trägt `content_hash` (über die kanonischen
  Quellfelder) und `source_version` (monoton, aus Job-Sequenz). Ein älterer Job darf
  einen neueren Eintrag nie überschreiben (Out-of-order-Schutz).
- Änderungsquellen: `courses`, `course_events`, `course_locations`,
  Kategorien-Zuordnungen, relevante `profiles`-Felder. Publish/Unpublish/Delete lösen
  prioritäre Jobs aus; Löschung entfernt Dokument+Chunks (Tombstone im Jobprotokoll).
- Täglicher Abgleich: Count-, Anti-Join- und Hash-Vergleich Quelle↔Index; Ziel 95 % der
  Änderungen < 5 Min., 99 % < 15 Min. (Zielwerte, werden gemessen, nicht behauptet).
- Embedding-Modellwechsel: parallele Indexversion (`model_version`), Zählabgleich,
  atomare Umschaltung, Rückschaltung möglich.

## 7. Sicherheits-Invarianten

- Kein Service-Key im Browser; Index-/Suchtabellen sind für `anon`/`authenticated`
  nicht direkt lesbar — Zugriff nur über die serverseitige Such-API.
- Kurs- und Nutzertexte sind untrusted: keine Anweisungen daraus befolgen; Reranker
  erhält nur abgegrenzte Evidenzfelder, keine Tools, keine Geheimnisse.
- Modellausgaben werden gegen erlaubte IDs/Felder validiert; unbekannte IDs, fremde
  Links und unbelegte harte Fakten werden verworfen bzw. als unklar markiert.
- Rohsuchtexte landen nicht in URL/Logs/Telemetrie; Messung aggregiert ohne PII.

## 8. Zugang und Monatskontingent (Nachtrag 07, verbindlich)

Quelle: `planung/.../07-nachtrag-ki-zugang-kontingent.md`. Drei Einstiege bleiben
erhalten: **Kategorien browsen** und **klassische Filtersuche** ohne Login und ohne
Kontingent; ausschliesslich die **KI-Suche** verlangt ein echtes eingeloggtes Konto und
ist auf **10 Suchen je Nutzer und Kalendermonat** begrenzt.

- **Kontoprüfung serverseitig:** fehlende, ungültige, abgelaufene und Supabase-anonyme
  Sitzungen werden abgewiesen, auch wenn sie die Rolle `authenticated` tragen
  (Prüfung auf `is_anonymous` im verifizierten JWT). Nutzerkennung nur aus der
  verifizierten Sitzung, nie aus einer Client-ID. Gespeicherte Suchergebnisse sind
  gleich geschützt; nach Logout kein Zugriff.
- **Monatsbegriff:** Kalendermonat `Europe/Zurich`, Rücksetzung zum lokalen
  Monatsbeginn, kein rollierendes Fenster, kein Übertrag (empfohlener Default laut
  Nachtrag §2). Resetdatum wird angezeigt.
- **Was zählt:** jede bewusst abgesendete neue KI-Suche und jede inhaltliche
  KI-Verfeinerung, auch bei identischer Eingabe/Cachetreffer und auch bei korrekt
  verarbeitetem Nulltreffer. **Was nicht zählt:** Login/Rückkehr, 3/5/10-Umschaltung,
  Zurück/Reload, lokale Filter und das Anzeigen bereits berechneter weiterer Treffer
  (dafür wird derselbe gespeicherte Ergebnisstand verwendet, keine neue Inferenz);
  Validierungs-/Login-/Limitablehnungen; echte System-/Providerfehler (Reservierung
  wird korrekt freigegeben — ohne Zusage, dass der externe Anbieter nichts berechnet).
- **Atomare Reservierung:** vor jedem kostenverursachenden Aufruf wird serverseitig
  atomar reserviert (Verbrauch + aktive Reservierungen ≤ 10, auch bei parallelen
  Tabs/Geräten); Erfolg finalisiert, echter Fehler gibt frei. Keine UI-Zählung und
  kein nicht-atomares Count-then-insert. Idempotente Such-ID je bewusstem Vorgang:
  Double-click/Retry/Reload erzeugt weder doppelte Inferenz noch doppelten Verbrauch;
  dieselbe ID darf nicht für veränderte Suchinhalte wiederverwendet werden.
  Reservierungen sind befristet (Crash-Recovery); verlorene Antworten nach Erfolg
  werden aus demselben Ergebnis wiederhergestellt, kein kostenloser Neulauf.
- **Keine Paket-Ausnahme:** Bezahlpakete erhalten kein höheres Kontingent; die
  bezahlte Anbieterpriorität innerhalb geeigneter Treffer (§Paid) bleibt davon
  getrennt.
- **Suchraum unverändert:** Die Zugangsbeschränkung verkleinert den durchsuchbaren
  öffentlichen Katalog nicht; alle Abdeckungs-/Muss-/Frische-Invarianten gelten
  unverändert. Vor dem Login wird der Suchtext nur lokal bewahrt und nach Rückkehr
  **nicht** automatisch abgesendet; keine Rohsuche in Login-URL oder Analytics.

## 9. Abnahme dieses Vertrags

Maschinenprüfbar über `tests/ai-search-*.test.js` (Preisstatus, Publikation, Chunking,
Muss/Event, Paid-Regel) sowie — nach Freigabe der Testumgebung (E5) — Migrations-/RLS-
und Reconciliation-Tests gegen das Supabase-Testprojekt. Produktionsdaten werden dafür
nicht verändert.
