# Phase 8.9 — Scenario OG-Image-Alt-Text-Eingabe-Fix

## Browserbefund

Im Entwurfsformular eines Szenarioartikels konnten für das **Karten-Bild** beide Felder
(URL-Upload und Alt-Text) normal verwendet werden. Das **Open-Graph-Bild-Alt-Text-Feld**
akzeptierte dagegen keinerlei Tastatureingabe:

- Keine Zeichen erschienen beim Tippen.
- Kein Wert wurde gespeichert.
- Keine sichtbare Fehlermeldung.
- Mehrfach reproduzierbar; das Formular wurde deshalb verworfen.

---

## Root Cause

Sechsschichtiger Bug — alle Schichten betrafen `og_image_alt` bei Szenarioartikeln:

| Schicht | Datei | Problem |
|---------|-------|---------|
| 1 Form-State | `AdminScenarioForm.jsx` | `og_image_alt` fehlte im `useState`-Initialwert |
| 2 AdminImageField (Props) | `AdminScenarioForm.jsx` | `altText=""` hardcoded statt `form.og_image_alt` |
| 3 AdminImageField (Callback) | `AdminScenarioForm.jsx` | `onAltTextChange={() => {}}` war No-Op → Eingaben verworfen |
| 4 loadScenario | `AdminScenarioForm.jsx` | `og_image_alt` wurde nicht aus DB-Response gemappt |
| 5 handleSave-Payload | `AdminScenarioForm.jsx` | `og_image_alt` fehlte im Payload (nie gesendet) |
| 6 API-Allowlist | `api/admin-theme-world-scenarios.js` | `'og_image_alt'` fehlte in `ALLOWED_WRITE_FIELDS` |
| 7 Validator | `api/_lib/theme-world-validate.js` | kein `optionalText`-Check für `og_image_alt` in `validateScenario` |
| 8 DB-Schema | `supabase/migrations/` | Spalte `og_image_alt` fehlte in `theme_world_scenarios` |

**Direkter Auslöser für das Eingabe-Problem:** `altText=""` und `onAltTextChange={() => {}}` in
`AdminScenarioForm.jsx` (Schicht 2 und 3). Jede Eingabe wurde sofort verworfen; der `value`-Prop
blieb immer `""`, weil der State nie aktualisiert wurde.

### Vergleich: Karten-Bild vs. Open-Graph-Bild (vor Fix)

```jsx
// Karten-Bild — korrekt verdrahtet (funktionierte)
<AdminImageField
  currentUrl={form.card_image_url}
  altText={form.card_image_alt}              // ← aus State
  onAltTextChange={(alt) => update({ card_image_alt: alt })}  // ← State-Update
/>

// OG-Bild — falsch verdrahtet (kein Input möglich)
<AdminImageField
  currentUrl={form.og_image_url}
  altText=""                                  // ← hardcoded, kein State-Bezug
  onAltTextChange={() => {}}                  // ← No-Op
/>
```

---

## Technische Lösung

### 1. `AdminScenarioForm.jsx` — 4 Änderungen

**a) Form-State — `og_image_alt` hinzugefügt:**
```jsx
const [form, setForm] = useState({
  card_image_url: '', card_image_alt: '', og_image_url: '', og_image_alt: '',
  // ...
});
```

**b) `loadScenario` — `og_image_alt` aus DB-Response mappen:**
```jsx
setForm({
  card_image_alt: data.card_image_alt || '',
  og_image_url: data.og_image_url || '',
  og_image_alt: data.og_image_alt || '',   // neu
  // ...
});
```

**c) `handleSave`-Payload — `og_image_alt` einfügen:**
```jsx
const payload = {
  card_image_alt: form.card_image_alt || null,
  og_image_url: form.og_image_url || null,
  og_image_alt: form.og_image_alt || null,  // neu
  // ...
};
```

**d) AdminImageField-Props für OG-Bild — korrekt verdrahten:**
```jsx
<AdminImageField
  currentUrl={form.og_image_url}
  altText={form.og_image_alt}                         // war: ""
  onAltTextChange={(alt) => update({ og_image_alt: alt })}  // war: () => {}
/>
```

### 2. `api/admin-theme-world-scenarios.js` — Allowlist

```js
const ALLOWED_WRITE_FIELDS = [
  'card_image_url', 'card_image_alt', 'og_image_url', 'og_image_alt',  // og_image_alt neu
  // ...
];
```

### 3. `api/_lib/theme-world-validate.js` — Validator

```js
optionalText(errors, data, 'card_image_alt', 200);
optionalText(errors, data, 'og_image_alt', 200);   // neu (max 200 Zeichen, optional)
```

### 4. `supabase/migrations/20260729_add_scenario_og_image_alt.sql` — DB-Schema

```sql
ALTER TABLE theme_world_scenarios
  ADD COLUMN IF NOT EXISTS og_image_alt text;
```

---

## Datenfluss: Formular bis Reload

```
[Tastatureingabe im OG-Alt-Feld]
        ↓
AdminImageField.onChange → onAltTextChange(value)
        ↓
update({ og_image_alt: value }) → setForm({ ...prev, og_image_alt: value })
        ↓
[Speichern]
        ↓
handleSave: payload.og_image_alt = form.og_image_alt || null
        ↓
API POST /admin-theme-world-scenarios?action=update
        ↓
filterWriteFields: og_image_alt in ALLOWED_WRITE_FIELDS → durchgelassen
        ↓
validateScenario: optionalText(..., 'og_image_alt', 200) → kein Fehler
        ↓
supabaseAdmin.update({ og_image_alt }) → DB-Spalte theme_world_scenarios.og_image_alt
        ↓
[Reload / erneutes Öffnen]
        ↓
getScenario → select('*') → data.og_image_alt vorhanden
        ↓
loadScenario: setForm({ og_image_alt: data.og_image_alt || '' })
        ↓
AdminImageField altText={form.og_image_alt} → Feld zeigt gespeicherten Wert
```

---

## Pflichtfeld- / Optionalstatus

| Feld | Pflicht | Bedingung |
|------|---------|-----------|
| `card_image_alt` | Pflicht | wenn `card_image_url` gesetzt (DB-Constraint + Validator) |
| `og_image_alt` | Optional | immer (kein DB-Constraint, `altRequired={false}` in Form) |

---

## Upload-Zeitpunkt

Upload startet **sofort bei Dateiauswahl** (in `AdminImageField.handleFileChange`):

1. Nutzer wählt Datei.
2. Clientseitige Validierung (MIME-Typ, Grösse < 5 MB).
3. Signierte Upload-URL beim Server anfordern (`/api/admin-theme-world-image?action=sign`).
4. Datei direkt auf Supabase Storage hochladen.
5. `onImageUploaded({ publicUrl })` wird aufgerufen → URL landet im Form-State.

**Upload ist nicht an den Speichervorgang des Artikels gekoppelt.**

---

## Orphan-Storage-Risiko

Wenn der Nutzer nach Bildauswahl das Formular **verwirft** (zurück ohne Speichern):

- Die Datei liegt in Supabase Storage (Ordner `theme-world-scenarios/`).
- Die URL ist im Form-State, aber nie in der DB gespeichert worden.
- Die Storage-Datei wird nicht mehr referenziert → **Orphan**.

**Aktuell:** Keine automatische Bereinigung vorhanden.

**Empfehlung (spätere Phase):** Periodische Bereinigung via Supabase Storage-Policy oder
scheduled function: alle `theme-world-scenarios/`-Dateien, deren URL in keiner
`theme_world_scenarios`-Zeile in `og_image_url` oder `card_image_url` vorkommt, können
gelöscht werden. Keine sofortige Aktion erforderlich; das Risiko ist gering (Szenario-Bilder
sind klein, Anbieter arbeiten meistens konzentriert).

---

## Testabdeckung

26 neue Unit-Tests in `tests/theme-world-phase8-9-scenario-og-alt-fix.test.jsx`:

| Test | Beschreibung |
|------|-------------|
| rendert OG-Alt-Feld | Feld ist im DOM vorhanden |
| Tippen möglich | Wert ändert sich nach fireEvent.change |
| Mehrere Eingaben | Letzter Wert bleibt erhalten |
| Umlaute | ÖÜÄ bleiben im Wert |
| Löschen + neu befüllen | Leeren und erneut füllen funktioniert |
| Unabhängigkeit | OG- und Karten-Alt beeinflussen sich nicht |
| Nach Bildupload | Feld bleibt nach onImageUploaded bearbeitbar |
| Karten-Alt | Funktioniert weiterhin (Regression) |
| Save-Payload (neu) | `og_image_alt` im createScenario-Payload |
| Reload lädt Wert | Gespeicherter og_image_alt erscheint nach loadScenario |
| Kein Dirty-State | Kein Auto-Save nach Reload |
| null → leer | Artikel ohne og_image_alt: leeres Feld, kein Fehler |
| undefined → leer | Fehlendes Feld im Response: leer, kein Fehler |
| Bearbeiten nach Reload | Wert lässt sich nach Reload ändern |
| Save-Payload (Update) | Geänderter og_image_alt im updateScenario-Payload |
| Karten-Alt nach Reload | card_image_alt korrekt geladen |
| Beide Alt-Felder | Werden unabhängig geladen |
| Allowlist | `'og_image_alt'` in ALLOWED_WRITE_FIELDS |
| Validator (valid) | Gültiger og_image_alt akzeptiert |
| Validator (> 200) | Zu langer Text wird abgelehnt |
| Validator (leer) | Leerer Wert akzeptiert (optional) |
| Validator (fehlt) | Fehlendes Feld akzeptiert (optional) |
| Migration-Datei | SQL-Datei enthält ADD COLUMN og_image_alt |
| Sport-Regression | Sport-Szenario ohne og_image_alt lädt korrekt |
| Yoga-Regression | Yoga-Szenario mit og_image_alt lädt korrekt |

Gesamt nach Fix: **1206 Tests** (vorher 1180, +26).

---

## Fokussierte Browser-Nachprüfung (Phase 8F.1)

Nach Deployment und Anwendung der Migration (`20260729_add_scenario_og_image_alt.sql`)
im Staging-Supabase-Projekt:

1. Control-Room öffnen → Test-Themenwelt → Szenarioartikel-Liste.
2. Ersten Szenarioartikel öffnen (Entwurf).
3. Open-Graph-Bild: bestehendes Bild belassen oder neu hochladen.
4. **OG-Alt-Text-Feld:** Beliebigen Text inkl. Umlaute tippen.
5. Feld leeren → erneut füllen.
6. Karten-Bild-Alt-Text unverändert lassen oder ebenfalls bearbeiten.
7. Speichern → Erfolgsmeldung abwarten.
8. Formular schliessen → Szenario erneut öffnen.
9. OG-Alt-Text-Feld muss gespeicherten Wert anzeigen.
10. Kein Dirty-State-Indicator nach dem Laden.

---

*Fix implementiert: 2026-07-29 · Branch: feature/dynamic-theme-worlds*
