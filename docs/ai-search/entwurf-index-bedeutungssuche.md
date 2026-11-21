# Entwurf: Index für die Bedeutungssuche (NICHT angewendet)

Stand 19.11.2026. Vorlage zur Entscheidung, keine Migration im Ordner
`supabase/migrations` (damit nichts versehentlich angewendet wird).

## Messbefund (Testumgebung, nur lesend, ohne Modellaufrufe)

| Messung | Ergebnis |
|---|---|
| Datenbestand | 2'771 Abschnitte, `vector(1024)`, pgvector 0.8.0, **kein** Vektorindex |
| `ai_search_semantic` erster Aufruf in neuer Verbindung | 1'863 ms |
| derselbe Aufruf wiederholt (warm) | **32 ms** |
| exakte Suche ohne Funktion (Seq Scan + Sortierung) | 33 ms |
| Preview-Suche 18.11. 22:10 (Server-Log) | Bedeutungssuche 3'117 ms, davon Query-Embedding 1'388 ms |
| GitHub-Probes (62 Suchen) | Bedeutungssuche 0,5–2,4 s inkl. Embedding |

**Folgerung:** Die eigentliche Vektorsuche dauert bei der heutigen Menge rund 30 ms.
Die beobachteten Sekunden entstehen durch Kaltstarts (erste Nutzung der
Datenbankverbindung bzw. der Vektor-Erweiterung, erste Verbindung zu OpenAI) und
Netzwerk. Ein Vektorindex würde die 30 ms kaum verringern und die Kaltstarts
nicht beseitigen. **Empfehlung: Index derzeit nicht anwenden.**

Zusätzlich gilt: Ein HNSW-Index liefert *näherungsweise* Treffer. Die heutige
Funktion sucht exakt über den ganzen Katalog (Nachtrag 12: keine
Abdeckungsverringerung). Damit der Index überhaupt greift, müsste die Funktion
auf „nächste k Abschnitte“ umgebaut werden, was bei mehreren Abschnitten pro Kurs
Kurse verlieren kann.

## Sinnvollere nächste Schritte (ohne Migration)

1. Kaltstart messen und gezielt angehen: Zeit für `ai_search_config` + RPC getrennt
   vom Query-Embedding protokollieren (Phasenmessung ist vorhanden).
2. Erst bei deutlich grösserem Katalog (Richtwert ab ~50'000 Abschnitten oder
   gemessenen > 200 ms warm) einen Index erneut prüfen.

## Migrationsentwurf (nur zur Ansicht)

```sql
-- ENTWURF – nicht anwenden ohne ausdrückliche Freigabe.
-- Näherungsindex für Kosinus-Distanz; nur Abschnitte mit Embedding.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_search_chunks_embedding_hnsw_idx
  ON public.ai_search_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- Rückweg:
-- DROP INDEX CONCURRENTLY IF EXISTS public.ai_search_chunks_embedding_hnsw_idx;
```

Hinweis: `CREATE INDEX CONCURRENTLY` darf nicht in einer Transaktion laufen; bei
Anwendung wäre der Supabase-Migrationsweg entsprechend anzupassen. Die Funktion
`ai_search_semantic` müsste für eine Indexnutzung zusätzlich umgebaut werden
(eigener Entwurf, erst nach Entscheidung).
