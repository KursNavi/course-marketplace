# Vergleich A (einstufig) / B (zweistufig) – 20.11.2026

GitHub-Lauf 44824674045 (Label `ki-luna-probe`, Commit `cbbb32f`), nur
TESTumgebung, kein Nutzerkontingent. Je Fall und Variante **ein** Durchlauf,
abwechselnd A → B, gleiche Einstellung (Denkstufe none, 3 × 10 reihum).
Zeiten: GitHub-Runner → Supabase/OpenAI, nicht Browser.

| Fall | Variante | Gesamt | davon KI | Score / Begründung | Kandidaten |
|---|---|---:|---:|---|---|
| Fotografie | A | 12,3 s | 8,5 s | Teilaufrufe 4,3 / 4,3 / **8,5 s** (1'223 Ausgabetokens) | 30 von 30 bewertet |
| Fotografie | B | 6,5 s | 4,5 s | 1,8 s + 2,8 s (10 Begründungen) | 30 von 30 bewertet |
| Fotografie, Muss Zürich | A | 6,7 s | 4,2 s | 3,7 / 3,8 / 4,2 s | 30 von 30 bewertet |
| Fotografie, Muss Zürich | B | 6,9 s | 4,8 s | 1,8 s + 3,0 s (10 Begründungen) | 30 von 30 bewertet |
| Programmierung | A | 5,1 s | 3,0 s | 2,4 / 2,7 / 3,0 s | 30 von 30 bewertet |
| Programmierung | B | 8,1 s | 6,0 s | 2,5 s + 3,5 s (4 Begründungen) | 30 von 30 bewertet |

- KI-Zeit zusammen: A 15,7 s, B 15,4 s (praktisch gleich). Gesamt A 24,1 s,
  B 21,4 s; der Unterschied stammt überwiegend aus einem einzelnen langsamen
  A-Teilaufruf und dem Kaltstart der ersten Suche (Query-Embedding 1,4 s).
- B hat eine feste Untergrenze aus zwei Stufen nacheinander (≈ 1,4–2,5 s +
  2,1–3,5 s); A ist meist schneller, hat aber Ausreisser bei langen Antworten.
- Qualität: in allen Fällen dieselben 30 gesendeten Kandidaten, alle gültig
  bewertet, 0 ungültige Einträge, 0 verworfene Texte, jede Karte mit
  wörtlichem Beleg. Trefferauswahl: Fotografie 9 von 11 Kursen gleich (je ein
  anderer Kurs auf Platz 10), Programmierung dieselben 4 (andere
  Reihenfolge). Textlänge A 19–35 Wörter, B 21–41 Wörter (≤ 50).
- Tokens: A 35'343 ein / 4'535 aus, B 44'350 ein / 3'281 aus.
- Fehler: keine. Die früheren Zweistufen-Fehler (Ausgabelimit,
  Antwortverarbeitung) traten nicht auf.

**Entscheidung:** kein messbarer Gesamtvorteil von B, der über die Streuung
eines Einzellaufs hinausgeht → **kein Wechsel**; Preview bleibt einstufig (A).
Das Fünf-Sekunden-Ziel ist mit beiden Varianten nicht erreicht.
