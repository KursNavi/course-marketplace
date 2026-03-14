# Anbieter-Test: technische To-do-Liste

## Sofort umgesetzt

- Kategoriequelle vereinheitlichen: Primärkategorie wird für Suche, Detailseite, Providerprofil und URL aus derselben Logik abgeleitet.
- Delivery-Logik vereinheitlichen: `delivery_types` ist die Hauptquelle; es gibt keinen stillen Fallback mehr auf `presence`.
- Online-Kurse robuster erkennen: Wenn Alt-Daten kein `delivery_types` haben, aber Ortsdaten klar auf online hindeuten, wird `online_live` abgeleitet.
- SEO-/Navigationspfade vereinheitlichen: Kurspfade nutzen jetzt dieselbe Primärkategorie wie Breadcrumbs und Suchresultate.
- Providerprofil mit konsistenteren Kursdaten versorgen: `delivery_types` und `all_categories` werden auch für öffentliche Anbieterprofile geladen.
- Regressionstests ergänzt für Kursformat- und Pfadkonsistenz.

## Nächste sinnvolle Schritte

- Publish-Flow mit gezielter Cache-/Dateninvalidierung absichern, damit neue Kurse in allen Facetten sofort erscheinen.
- End-to-End-Test für den Flow `Kurs erstellen -> veröffentlichen -> globale Suche -> Segmentfilter -> Detailseite -> Anbieterprofil` ergänzen.
- Monitoring für 403-/WAF-Sperren im QA-Traffic ergänzen und Test-IPs bzw. Test-Umgebung sauber whitelisten.
- Datenmigration prüfen: Alt-Kurse ohne `delivery_types` und ohne vollständige Taxonomie bereinigen, damit weniger Heuristiken nötig sind.
