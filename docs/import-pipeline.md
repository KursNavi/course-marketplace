# Provider-Import-Pipeline: PR 1 lokale Draft-Struktur

Diese erste Ausbaustufe legt nur eine lokale, überprüfbare Import-Struktur für KursNavi an. Sie definiert JSON-Schemas, Beispiel-Dateien, ein lokales Validierungs-Script und Tests für Provider- und Kurs-Drafts.

## Zweck

Die Pipeline soll zukünftig Daten über Schweizer Kursanbieter nachvollziehbar vorbereiten. In PR 1 werden dafür ausschließlich lokale Draft-Dateien beschrieben:

- Anbieter-Entwurf (`schemas/import/provider-import.schema.json`)
- Kurs-Entwürfe (`schemas/import/course-import.schema.json`)
- Import-Run-Metadaten (`schemas/import/import-run.schema.json`)

Wichtige Felder werden als Evidence-Objekte modelliert. Diese enthalten:

- `value`
- `source_url`
- `evidence_text`
- optional `needs_review`

## Warum PR 1 noch keinen Import macht

PR 1 importiert bewusst nichts in `profiles`, `courses` oder andere Produktivtabellen. Die Änderung ist eine Sicherheits- und Qualitätsgrundlage: Erst wenn Draft-Struktur, Evidence-Regeln und lokale Validierung stabil sind, können spätere PRs weitere Pipeline-Schritte ergänzen.

## Sicherheitsregeln

Für diese Stufe gelten harte Grenzen:

- Kein Crawling
- Keine KI-Generierung
- Kein OpenAI API Call
- Kein Supabase-Zugriff
- Keine Live-Datenbank
- Keine Secrets
- Kein Import in `profiles` oder `courses`
- Keine Veröffentlichung
- Keine Änderung an bestehenden Produktiv-Flows

Das Validierungs-Script arbeitet ausschließlich mit lokalen JSON- und Schema-Dateien.

## Default-Regeln für Import-Drafts

- Anbieter werden nicht veröffentlicht.
- `profile_published_at` ist immer `null`.
- Kurse haben `status: "draft"`.
- Kurse haben `booking_type: "lead"`.
- Preise sind nur mit `source_url` und `evidence_text` zulässig; ohne Evidence bleiben sie `null`.
- Termine sind nur mit `source_url` und `evidence_text` zulässig; ohne Evidence bleibt die Liste leer.
- Bilder werden nur als Kandidaten gespeichert.
- Bild-Kandidaten haben `rights_status: "unknown"` und `needs_review: true`.

## Lokal validieren

Ein kompletter Beispiel-Run kann so geprüft werden:

```bash
npm run import:validate
```

Eine einzelne lokale JSON-Datei kann direkt geprüft werden:

```bash
node scripts/import-pipeline/validate-import-json.mjs examples/import/import-run.example.json
```

Das Script beendet erfolgreiche Validierungen mit Exit-Code `0` und fehlerhafte Validierungen mit Exit-Code `1`.

## Geplante nächste PRs

1. Taxonomie-Mapping
2. Crawler
3. KI-Extraktion
4. Zweite QA
5. Staging-Import
6. Screenshots
7. E-Mail-Entwurf
