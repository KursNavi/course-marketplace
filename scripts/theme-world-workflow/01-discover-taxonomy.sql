-- KursNavi Themenwelt-Workflow: Taxonomie zum Thema finden
-- Nur den params-Block anpassen. Diese Abfrage ist read-only.
-- Ergebnis als 01-angebot/01-taxonomie.csv in der Themenwelt-Arbeitsmappe speichern.

with params as (
  select
    array['__SUCHBEGRIFF_1__', '__SUCHBEGRIFF_2__']::text[] as search_terms,
    false::boolean as include_drafts
),
taxonomy as (
  select distinct
    v.level1_slug,
    v.level1_label_de,
    v.level2_slug,
    v.level2_label_de,
    v.level3_slug,
    v.level3_label_de,
    v.level4_slug,
    v.level4_label_de,
    v.course_id
  from public.v_course_full_categories v
  join public.courses c on c.id = v.course_id
  cross join params p
  where (p.include_drafts or c.status = 'published')
),
ranked as (
  select
    t.level1_slug,
    t.level1_label_de,
    t.level2_slug,
    t.level2_label_de,
    t.level3_slug,
    t.level3_label_de,
    t.level4_slug,
    t.level4_label_de,
    count(distinct t.course_id) as course_count,
    array_agg(distinct term order by term) filter (
      where lower(concat_ws(' ',
        t.level1_slug, t.level1_label_de,
        t.level2_slug, t.level2_label_de,
        t.level3_slug, t.level3_label_de,
        t.level4_slug, t.level4_label_de
      )) like '%' || lower(term) || '%'
    ) as matched_terms
  from taxonomy t
  cross join params p
  cross join lateral unnest(p.search_terms) as term
  group by
    t.level1_slug, t.level1_label_de,
    t.level2_slug, t.level2_label_de,
    t.level3_slug, t.level3_label_de,
    t.level4_slug, t.level4_label_de
)
select *
from ranked
where coalesce(cardinality(matched_terms), 0) > 0
order by course_count desc, level1_slug, level2_slug, level3_slug, level4_slug nulls first;
