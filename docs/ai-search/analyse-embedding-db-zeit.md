# Analyse: Zeitanteil Query-Embedding und Datenbank (ohne neue Messläufe)

Stand 20.11.2026. Grundlage ausschliesslich vorhandene Messungen, keine neuen
Modell- oder Datenbankaufrufe. **Keine Indexmigration** (siehe
`entwurf-index-bedeutungssuche.md`: Vektorsuche warm ≈ 32 ms).

## Daten

1. **77 Suchen aus den GitHub-Messläufen** vom 18.11.2026 (Runner in den USA →
   Supabase/OpenAI; nicht Browser, nicht Vercel), Phasen in ms:

   | Phase | Median | p90 | Max |
   |---|---:|---:|---:|
   | Abdeckungsprüfung (parallel) | 408 | 577 | 970 |
   | Lexikalischer Abruf (parallel) | 384 | 581 | 890 |
   | Query-Embedding | 213 | 546 | 1'313 |
   | Bedeutungssuche gesamt (parallel, kritischer Pfad) | 923 | 1'355 | 2'802 |
   | davon Konfiguration + Vektorabfrage (ohne Embedding) | 551 | 1'004 | 1'875 |
   | Kandidaten laden (sequenziell danach) | 1'118 | 1'492 | 1'808 |
   | **alles ausser Luna** | **2'060** | 2'703 | 4'439 |
   | Luna | 4'511 | 7'837 | 16'230 |

   Erste Suche je Lauf (kalt, n=5): Embedding Median 1'155 ms; danach (warm,
   n=72) 211 ms.

2. **Zwei echte Preview-Suchen** (Vercel fra1, Server-Log):

   | | Embedding | Bedeutungssuche ohne Embedding | Kandidaten laden | ohne Luna |
   |---|---:|---:|---:|---:|
   | 18.11. 22:10 | 1'388 | 1'729 | 496 | ≈ 3'650 |
   | 19.11. 19:45 (13,8-s-Messung) | 2'540 | 1'775 | 562 | ≈ 5'540 |

3. Datenbank direkt (19.11.): Vektorabfrage 1'863 ms in neuer Verbindung,
   32 ms warm.

## Befund

- **In der Preview dominiert der Kaltstart**, nicht die Rechenzeit: Das
  Embedding brauchte dort 1,4–2,5 s statt warm ≈ 0,2 s; Konfiguration plus
  Vektorabfrage 1,7–1,8 s statt warm ≈ 0,55 s. Beides passt zu neu
  aufzubauenden Verbindungen (DNS/TLS zu OpenAI, erste Anfragen einer frischen
  Funktionsinstanz an Supabase) und der kalten Vektorabfrage.
- Die Bedeutungssuche ist der **kritische Pfad** der parallelen Phase und
  besteht aus drei Schritten nacheinander: Konfiguration lesen → Embedding →
  Vektorabfrage. Das Embedding bleibt bewusst nach der Konfiguration (kein
  kostenpflichtiger Aufruf bei inaktiver Indexversion).
- **Kandidaten laden** sind zwei Rundreisen nacheinander (Kurse, danach
  Abschnitte/Anbieter/Kategorien parallel), obwohl Abschnitte und Kategorien
  nur die Kurs-IDs brauchen, die schon vorher feststehen.
- Nur zwei Preview-Messpunkte: kein P95-Nachweis. Weitere Preview-Messungen
  bräuchten echte Suchen (nicht auf Kosten des Nutzerkontingents).

## Vorschläge (ohne Migration, noch nicht umgesetzt)

1. **Verbindungen vorwärmen**, während Anmeldung und Kontingentreservierung
   laufen (≈ 0,4 s): kostenfreie Anfrage an OpenAI (`GET /v1/models/<id>`),
   damit DNS/TLS beim Embedding schon stehen. Kein Embedding vor der
   Kontingentprüfung.
2. **Konfiguration kurz zwischenspeichern** (je Funktionsinstanz, z. B. 60 s):
   spart eine Datenbankrundreise auf dem kritischen Pfad; die Schutzregel
   „kein Embedding bei inaktiver Version“ bleibt mit kurzer Gültigkeit
   erhalten.
3. **Kandidaten laden parallelisieren**: Abschnitte und Kategorien zusammen
   mit den Kursen abfragen; nur die Anbieter warten auf die Kurse.

Erwartung grob: in der Preview 1–2 s weniger ausserhalb von Luna; Wirkung
nur mit neuen Messpunkten belegbar.
