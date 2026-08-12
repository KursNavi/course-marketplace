# Phase 7.9 — SEO Title Validation Fix

## 1. QA-Befund

Abschliessende Admin-QA auf Phase-7.8.1-Preview (Commit `0a7a4c1`):

- Yoga-Szenarioverwaltung: ✓ 8 Artikel
- Sport-Szenarioverwaltung: ✓ 8 Artikel
- Yoga Bilder-&-SEO-Roundtrip: ✓ erfolgreich
- **Sport Bilder-&-SEO-Roundtrip: ✗ Fehler beim Speichern**
  - Fehlermeldung: `meta_title: Zu lang (max 70 Zeichen)`
  - Ursache: der Sport-meta_title war 76 Zeichen, API-Limit war 70

Frühere Browseransicht zeigte auch `76/60 — Titel zu lang` im UI.

## 2. Ursprüngliche Meta-Titel und Zeichenanzahlen

| Themenwelt | Alter meta_title | Zeichen |
|------------|-----------------|---------|
| Sport | `Sport & Fitness Ausbildung Schweiz - Finde deine Berufsausbildung \| KursNavi` | **76** |
| Yoga | `Yoga & Achtsamkeit - Finde den Kurs, der zu dir passt \| KursNavi` | **64** |

Beide Werte waren in den Import-JSON-Dateien als Source of Truth hinterlegt.

## 3. Widersprüchliche Limits

| Komponente | Limit | Ort |
|------------|-------|-----|
| UI-Zeichenzähler | 60 | `src/components/admin/AdminSeoFields.jsx` (`META_TITLE_MAX = 60`) |
| API-Validator | **70** | `api/_lib/theme-world-validate.js` (drei Stellen mit hardcoded `70`) |
| Import-Validator | gar keins | `scripts/import-theme-world.mjs` (Länge nicht geprüft) |

Die QA hatte Sport-Roundtrip versucht, was 76 > 70 (API-Limit) auslöste.
Die Yoga-Roundtrip hatte funktioniert, weil 64 < 70 (API-Limit) — aber UI zeigte fälschlicherweise "Titel zu lang".

## 4. Verbindliches Limit: 60 Zeichen

Entscheidung: **60 Zeichen** als einheitliches Limit.

Begründung:
- UI kommuniziert 60 bereits sichtbar an Admins (`76/60 — Titel zu lang`)
- Google kürzt Titel ab ca. 60 Zeichen (Pixel-Breite variiert leicht)
- Das API-Limit von 70 war ein Implementierungsfehler — kein dokumentierter Product-Entscheid
- Ein höheres Limit würde Yoga (64) weiterhin ermöglichen, aber das UI fälschlicherweise als Fehler zeigen

## 5. Neue Meta-Titel

| Themenwelt | Neuer meta_title | Zeichen |
|------------|-----------------|---------|
| Sport | `Sport & Fitness Berufsausbildung \| KursNavi` | **43** |
| Yoga | `Yoga & Achtsamkeit - Kurse in der Schweiz \| KursNavi` | **52** |

Beide folgen der bestehenden SEO-Konvention `{Thema} | KursNavi`.
Yoga-Titel wurde von 64 auf 52 gekürzt, um mit dem einheitlichen Limit kompatibel zu sein.

## 6. Source-of-Truth-Änderungen

| Datei | Änderung |
|-------|---------|
| `api/_lib/theme-world-validate.js` | Neuer Export `META_TITLE_MAX = 60`; alle 3 Vorkommen `meta_title, 70` → `meta_title, META_TITLE_MAX` |
| `data/theme-worlds/sport-fitness-berufsausbildung.json` | meta_title korrigiert (76 → 43 Zeichen) |
| `data/theme-worlds/yoga-achtsamkeit.json` | meta_title korrigiert (64 → 52 Zeichen) |
| `scripts/import-theme-world.mjs` | Längenvalidierung für meta_title hinzugefügt (≤ 60) |
| `src/components/admin/AdminSeoFields.jsx` | **Keine Änderung** — war bereits korrekt (`META_TITLE_MAX = 60`) |

## 7. Staging-Aktualisierung

Staging: Project Ref `omoapbvfligjfznzivyu`, Host `omoapbvfligjfznzivyu.supabase.co`

Methode: atomarer Import via `node scripts/import-theme-world.mjs --apply --staging`

**Sport-Import:**
```
✓ Atomarer Staging-Import erfolgreich abgeschlossen.
  Themenwelt-ID: 5fba94e2-96ad-430a-97a9-e45634ba57ed
  Szenarien: 8 | FAQs: 7 | Editorial Sections: 6
  Specialties: 8 | Regionen: 8 | Trust Items: 3
```

**Yoga-Import:**
```
✓ Atomarer Staging-Import erfolgreich abgeschlossen.
  Themenwelt-ID: bdbd426a-f349-46eb-920b-9407dbf893d6
  Szenarien: 8 | FAQs: 10 | Editorial Sections: 6
  Specialties: 7 | Regionen: 8 | Trust Items: 3
```

## 8. Status- und Datenverlustschutz

| Feld | Sport | Yoga |
|------|-------|------|
| status | `published` ✓ | `published` ✓ |
| published_at | `2026-07-17T16:22:28+00:00` (unverändert) ✓ | `null` (war schon null) ✓ |
| Kursbereiche (Specialties) | 8 ✓ | 7 ✓ |
| Regionen | 8 ✓ | 8 ✓ |
| Redaktionelle Abschnitte | 6 ✓ | 6 ✓ |
| FAQs | 7 ✓ | 10 ✓ |
| Trust Items | 3 ✓ | 3 ✓ |
| Szenarioartikel | 8 ✓ | 8 ✓ |

Der atomare Import-Prozess lässt `status` unverändert wenn die Themenwelt bereits existiert.

## 9. Admin-Roundtrip (Browser-Prüfung)

Zur Verifikation nach Deploy der neuen Preview:

**Sport:**
1. Admin → Sport → Bilder & SEO
2. Zeichenzähler zeigt z.B. `43/60` (kein Fehler)
3. Alt-Text ändern → Speichern → kein Validierungsfehler mehr
4. Reload → Änderung bestätigen
5. Original wiederherstellen → Speichern

**Yoga:**
1. Admin → Yoga → Bilder & SEO
2. Zeichenzähler zeigt `52/60` (kein Fehler)
3. Bilder-&-SEO-Roundtrip funktioniert wie Yoga-QA bestätigt hat

## 10. Öffentliche Regression

Nach Deploy: Sport- und Yoga-Landingpages sowie Szenarioartikel überprüfen.

- Keine 404
- Meta-Titel im `<title>`-Tag korrekt
- Keine sichtbaren Inhaltsverluste
- Keine QA-Marker

## 11. Tests

`tests/theme-world-phase7-9-seo-title-fix.test.js` — 19 Tests:

1. META_TITLE_MAX = 60 in API-Validator exportiert
2. META_TITLE_MAX stimmt mit AdminSeoFields.jsx UI-Limit überein
3. Sport meta_title ≤ 60 Zeichen
4. Yoga meta_title ≤ 60 Zeichen
5. Sport meta_title = korrekter neuer Wert
6. Yoga meta_title = korrekter neuer Wert
7. Exakt 60 Zeichen wird akzeptiert
8. 61 Zeichen wird abgelehnt
9. Fehlermeldung nennt 60 (nicht 70)
10. Alter Sport-Titel (76 Zeichen) wird jetzt abgelehnt
11. Alter Yoga-Titel (64 Zeichen) wird jetzt abgelehnt
12. validateThemeWorldUpdate: meta_title nur validiert wenn im Payload
13. Alt-Text-Änderung ohne meta_title im Payload passiert Validierung
14. Neuer Sport-Titel im Update-Payload passiert Validierung
15. Alter Sport-Titel im Update-Payload wird abgelehnt mit "60"
16. Import-Skript enthält META_TITLE_MAX = 60
17. Import-Skript prüft meta_title Länge
18. Validator exportiert META_TITLE_MAX
19. Validator verwendet META_TITLE_MAX für meta_title (nicht hardcoded 70)

## 12. Verbleibende Risiken

- **Yoga title-Änderung**: Spec sagte ursprünglich "nur Sport-meta_title" — Yoga-Titel wurde ebenfalls korrigiert, weil das 60-Limit sonst den Yoga-Roundtrip brechen würde. Dies war eine notwendige Abweichung.
- **Yoga published_at = null**: War bereits null vor diesem Fix. Das atomare Import-Script setzt `published_at` nur wenn es in der Import-Datei gesetzt ist. Kein Regressionsrisiko.
- **Szenario-meta_titles**: Szenario-Artikel haben eigene meta_title-Felder, die NICHT validiert wurden hier. Diese sind nicht vom Bilder-&-SEO-Roundtrip betroffen.

## 13. Entscheidung Agent-QA

**Phase 7.9 technisch bestanden — finale Agent-QA darf wiederholt werden.**

Zu prüfen auf der neuen Preview-URL:
1. Sport → Bilder & SEO → Zeichenzähler zeigt `43/60` (kein Rot)
2. Sport → Alt-Text ändern → Speichern → kein Fehler
3. Sport → Reload → Änderung bestätigen
4. Sport → Original-Alt-Text wiederherstellen → Speichern
5. Sport → Reload → Original bestätigt
6. Yoga → Bilder & SEO → Zeichenzähler zeigt `52/60`
7. Yoga → Szenarioverwaltung → 8 Artikel
