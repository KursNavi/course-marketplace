# Prompt — Research synthetisieren und Claims freigabefertig machen

## Rolle

Du bist Faktenredakteur:in. Führe die Deep-Research-Berichte zu einer widerspruchsfreien Arbeitsgrundlage zusammen. Recherchiere nicht neu; öffne Quellen nur zur Kontrolle, wenn der Auftrag dies zulässt.

## Inputs

- `dr-01-landscape.md`
- optional `dr-02-trust-safety.md`
- optional `dr-03-search-gaps.md`
- aktuelles `sources.csv`
- aktuelle `claims.md`
- freigegebene `content-map.md`

## Auftrag

1. Dedupliziere Quellen und vergib stabile `S###`-IDs.
2. Dedupliziere Aussagen und vergib stabile `C###`-IDs.
3. Prüfe, ob jede Quelle die ihr zugewiesene Aussage tatsächlich und in derselben Reichweite stützt.
4. Kennzeichne Primär-/Sekundärquelle, Autorität, Geografie, Aktualität und Konflikte.
5. Formuliere pro Claim:
   - präzise freigabefähige Aussage;
   - zulässige vorsichtige Formulierung;
   - zu vermeidende Überdehnung;
   - vorgesehene Content-Stelle.
6. Setze nur belastbare Claims auf `approved`; alles andere bleibt `candidate`, `rejected` oder `needs-update`.
7. Erstelle `article-source-map.json`: Ordne jedem Szenario nur tatsächlich verwendete Quellen zu, priorisiert nach direkter Relevanz, Autorität, Schweiz-Bezug, Aktualität und Herausgebervielfalt.
8. Wähle idealerweise 3–6, höchstens 10 öffentliche Quellen je Szenario. Verwende direkte Original-URLs und keine allgemeinen Startseiten, wenn konkrete Publikationen verfügbar sind.
9. Liste offene Entscheidungen separat. Fülle keine Lücken durch Vermutung.

## Ausgabe

1. Vollständiger Ersatzinhalt für `sources.csv`.
2. Vollständiger Ersatzinhalt für `claims.md`.
3. Vollständiger Inhalt für `article-source-map.json`.
4. Kurzer Freigabebericht mit Stop-Punkten für das Copywriting.
