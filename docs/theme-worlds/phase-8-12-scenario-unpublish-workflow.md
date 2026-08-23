# Phase 8.12 — Scenario Unpublish Workflow

## Bisherige Produktlücke

Die Phase-3-Dokumentation beschreibt ausdrücklich den Statusübergang
`published → draft` über eine `unpublish`-Action. Diese Action fehlte
jedoch vollständig in:

- `api/admin-theme-world-scenarios.js` (kein `unpublish`-Case)
- `src/lib/themeWorldAdminApi.js` (keine `unpublishScenario()`-Funktion)
- `src/components/admin/AdminScenarioList.jsx` (kein Zurückziehen-Button)

Admins, die einen publizierten Artikel korrigieren wollten, hatten keine
kontrollierte Möglichkeit, ihn öffentlich auszublenden ohne ihn dauerhaft
zu archivieren. Archivieren ist kein Ersatz:

- `archived → published` wird durch die API mit HTTP 409 blockiert
- `archived → draft` ist nicht implementiert
- Die Admin-Oberfläche bietet keine Wiederherstellung archivierter Artikel

## Unterschied zwischen Zurückziehen und Archivieren

| Aspekt | Zurückziehen (unpublish) | Archivieren |
|--------|--------------------------|-------------|
| Zielstatus | `draft` | `archived` |
| Öffentlich sichtbar | Nein | Nein |
| Bearbeitbar | Ja | Ja |
| Erneut publizierbar | Ja | Nein (blockiert) |
| `published_at` | wird auf `null` gesetzt | bleibt gesetzt |
| Zweck | Temporäre Korrektur | Endgültige Entfernung |

## Statusübergänge

```
draft ──publish──▶ published ──unpublish──▶ draft
  │                   │
  └──archive──▶ archived ◀──archive──┘

archived → published: blockiert (HTTP 409)
archived → draft:     nicht implementiert
```

Vollständige Matrix nach Phase 8.12:

| Von | Nach | Unterstützt |
|-----|------|-------------|
| draft | published | Ja (publish) |
| published | draft | Ja (unpublish) |
| draft | archived | Ja (archive) |
| published | archived | Ja (archive) |
| archived | published | Nein (409) |
| archived | draft | Nein |

## Warum `published_at` beim Zurückziehen auf null gesetzt werden muss

Die Tabelle `theme_world_scenarios` besitzt einen Check-Constraint
sinngemäss:

```sql
CHECK (
  published_at IS NULL
  OR status IN ('published', 'archived')
)
```

Ein Datensatz mit `status = 'draft'` und einem gesetzten `published_at`
würde diesen Constraint verletzen. Deshalb muss beim Zurückziehen
zwingend beides atomar gesetzt werden:

```sql
UPDATE theme_world_scenarios
SET status = 'draft', published_at = NULL
WHERE id = $id;
```

Beim erneuten Publizieren wird `published_at` vom Server auf
`new Date().toISOString()` gesetzt (nur beim ersten Publish; bei erneutem
Publish nach Zurückziehen wird es erneut gesetzt).

## API-Action

**Endpunkt:** `POST /api/admin-theme-world-scenarios?action=unpublish&id=<uuid>`

**Authentifizierung:** Bearer Token + Admin-Berechtigung (wie publish/archive)

**Ablauf:**
1. Admin-Auth prüfen
2. UUID validieren (400 bei fehlender/ungültiger ID)
3. Szenario laden (404 wenn nicht gefunden)
4. Status prüfen: nur `published` erlaubt (409 bei `draft` oder `archived`)
5. Atomar aktualisieren: `{ status: 'draft', published_at: null }`
6. Aktualisierten Datensatz zurückgeben: `id, status, published_at, updated_at`

**Fehlermeldungen:**

| HTTP | Meldung |
|------|---------|
| 400 | Ungültige oder fehlende ID. |
| 401 | Nicht autorisiert. |
| 403 | Kein Admin-Zugriff. |
| 404 | Szenario nicht gefunden. |
| 409 | Nur publizierte Szenarioartikel können zurückgezogen werden. |
| 500 | Zurückziehen fehlgeschlagen. |

**Erfolgs-Response (HTTP 200):**
```json
{
  "data": {
    "id": "...",
    "status": "draft",
    "published_at": null,
    "updated_at": "..."
  },
  "message": "Artikel wurde zurückgezogen und ist wieder als Entwurf gespeichert."
}
```

## API-Client

Neue Funktion in `src/lib/themeWorldAdminApi.js`:

```js
export async function unpublishScenario(id) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=unpublish&id=${encodeURIComponent(id)}`,
    { method: 'POST' },
  );
  return result.data;
}
```

Kein direkter Supabase-Client-Schreibzugriff. Fehler werden als `ApiError`
mit HTTP-Status und Meldung weitergereicht.

## Admin-Aktion und Dialog

In `AdminScenarioList.jsx`:

- **Button:** `EyeOff`-Icon, Titel "Zurückziehen", amber-Farbe
- Nur bei `status === 'published'` sichtbar
- Nicht bei `draft`, nicht bei `archived`
- Archivieren bleibt als separate Aktion bestehen

**Bestätigungsdialog:**
- Titel: "Artikel zurückziehen"
- Text: "Der Artikel wird öffentlich ausgeblendet und wieder als Entwurf gespeichert. Er kann anschliessend bearbeitet und erneut publiziert werden."
- Artikelname wird angezeigt
- Buttons: "Abbrechen" (keine Action) / "Zurückziehen" (amber, ruft `unpublishScenario()` auf)
- Keine Formulierung "Archivieren" im Dialog

**Nach Erfolg:**
- Erfolgsmeldung via `showNotification`
- `fetchData()` lädt die Liste neu
- Artikel erscheint als Entwurf
- Publizieren-Button erscheint wieder (wenn Eltern-TW publiziert ist)
- Zurückziehen-Button verschwindet
- Archivieren bleibt verfügbar

## Öffentliche Unsichtbarkeit durch RLS

Die öffentliche Row Level Security liest ausschliesslich:

```sql
WHERE status = 'published'
```

Nach `unpublish` ist `status = 'draft'` → der Artikel ist für anonyme
Besucher nicht lesbar. Die Eltern-Themenwelt bleibt publiziert; andere
publizierte Artikel bleiben sichtbar.

Keine Änderung an RLS oder öffentlichem Renderer erforderlich.

## Erneutes Publizieren

Nach dem Zurückziehen kann der Artikel bearbeitet und über denselben
Publish-Flow erneut publiziert werden:

1. Admin öffnet AdminScenarioList → Artikel hat Status "Entwurf"
2. Wenn Eltern-TW publiziert: Publizieren-Button sichtbar
3. Klick auf Publizieren → serverseitige Validierung → `status = 'published'`, `published_at = now()`

## Browser-QA für Artikel 3

Nach vollständiger Implementierung kann Artikel 3 kontrolliert
zurückgezogen werden:

1. Öffne `/control-room-2025` → Themenwelt mit Artikel 3 auswählen
2. Szenarioartikel-Liste: Artikel 3 hat Status "Publiziert"
3. Klick auf EyeOff-Button (Zurückziehen)
4. Dialog "Artikel zurückziehen" erscheint mit korrektem Artikelnamen
5. Klick auf "Zurückziehen"
6. Liste aktualisiert: Artikel 3 zeigt Status "Entwurf"
7. Publizieren-Button erscheint wieder
8. Öffentliche URL des Artikels liefert keine Inhalte mehr
9. Andere publizierte Artikel bleiben sichtbar

**Hinweis:** Artikel 3 wurde während der Implementierung nicht verändert.
Der QA-Schritt erfolgt manuell nach Browser-Validierung.

## Keine Datenbankmigration erforderlich

Die Statuswerte `draft`, `published`, `archived` existieren bereits.
Der `published_at`-Constraint erlaubt `NULL` bei `draft`-Status bereits.
Es wird lediglich der bestehende `update`-Mechanismus genutzt.

Keine neue Spalte, keine Migration, keine Constraint-Änderung.
