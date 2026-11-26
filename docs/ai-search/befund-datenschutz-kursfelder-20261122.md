# Befund Datenschutz: öffentlich lesbare Kursfelder und Entwürfe (22.11.2026)

Eigenständiger Befund, unabhängig von der Abnahme der KI-Suche.
- Es wurden nur Zugriffsregeln, Code und Zählungen geprüft. Keine Inhalte gelesen, keine
  Rechte verändert.
- **Korrektur zum Abnahmebericht §6:** Die Migration belegt eine technische Entscheidung im
  Code, aber **keine Datenschutzfreigabe** durch die verantwortliche Person.

## 1. Was technisch gilt (Produktion, lesend belegt)

**Zugriffsregeln:**
- Die Richtlinien „public read all for URL previews“ auf `courses`, `course_events`,
  `course_locations` und `course_category_assignments` erlauben den Rollen `anon` und
  `authenticated` das Lesen **aller Zeilen** (Bedingung `true`).
- Dazu kommt das Tabellenrecht `SELECT` für `anon` auf **alle Spalten** von `courses`.
- Damit ist über die öffentliche Schnittstelle mit dem öffentlichen Schlüssel jede Kurszeile
  lesbar, auch Entwürfe, samt Feldern, die die Website nicht anzeigt.

**Herkunft:** Migration `20260911120000_restore_course_status_and_preview_access.sql` und Test
`tests/course-draft-preview-visibility.test.js`. Die Begründung dort lautet: „Draft ist
Such- bzw. Indexstatus, keine Schutzgrenze; wer die Kurs-URL kennt, darf die Details sehen.“

**Zählungen (nur Anzahl, keine Inhalte):**

| | Entwürfe | veröffentlicht |
|---|---:|---:|
| Kurse gesamt | 203 | 697 |
| mit gefülltem `courses.contact_email` | 0 | 47 |

**Code:** Kein Teil der Plattform liest oder zeigt `courses.contact_email`, weder Website
noch Schnittstellen noch KI-Suche. Gesucht wurde in `src/` und `api/`.

## 2. Bewertung

| Punkt | Bewertung |
|---|---|
| Entwürfe lesbar | Technisch so gebaut und im Code begründet (Vorschau-Links). **Ob das datenschutzrechtlich gewollt ist, ist nicht belegt** und muss entschieden werden: Entwurfsinhalte von Anbietern sind für jeden mit dem öffentlichen Schlüssel abrufbar, nicht nur für Personen mit dem Link |
| 47 `contact_email` lesbar | Die Website zeigt die Adressen nirgends, die Schnittstelle gibt sie trotzdem heraus. Vorgesehene und tatsächliche Öffentlichkeit weichen voneinander ab |
| Weitere nicht angezeigte Felder | Gleiches Muster möglich, etwa bei `external_link`, `provider_url`, `plan_tier`, `ticket_limit_30d`. Nicht einzeln geprüft |

## 3. Folge für die KI-Suche

- Die KI-Suche liest, speichert und zeigt keines dieser Felder (Positivliste, Datenvertrag
  §2, Tests). Sie zeigt nur veröffentlichte Kurse.
- Ihre Einführung erweitert die Lesbarkeit nicht.
- **Kein Veröffentlichungshindernis für die KI-Suche.**

## 4. Offene Entscheidung (Plattform, nicht umgesetzt)

1. Sollen Entwürfe über die öffentliche Schnittstelle lesbar bleiben?
   - Alternative: Lesen nur für den Eigentümer, Vorschau über einen signierten Link oder eine
     Serverfunktion.
2. Sollen nicht angezeigte Felder für `anon` gesperrt werden (Spaltenrechte) oder das Altfeld
   `contact_email` geleert werden?

Beides wären Produktionsänderungen. Sie brauchen eine eigene Entscheidung und Freigabe und
sind **nicht** Teil der KI-Suche.
