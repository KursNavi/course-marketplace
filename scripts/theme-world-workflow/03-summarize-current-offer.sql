-- KursNavi Themenwelt-Workflow: Angebots-Aggregate für Strukturentscheidungen
-- params identisch zu 02-export-current-offer.sql setzen.
-- Ergebnis als 01-angebot/03-aggregate.csv speichern.

with params as (
  select
    'privat'::text as db_segment,
    'yoga_achtsamkeit'::text as area_slug
),
matched as (
  select distinct c.id, c.user_id, c.price, c.delivery_types, c.level
  from public.courses c
  join public.v_course_full_categories v on v.course_id = c.id
  cross join params p
  where c.status = 'published'
    and v.level1_slug = p.db_segment
    and v.level2_slug = p.area_slug
),
dimensions as (
  select 'overview'::text as dimension, 'courses'::text as label, count(*)::bigint as course_count
  from matched
  union all
  select 'overview', 'providers', count(distinct user_id)::bigint
  from matched
  union all
  select 'specialty', v.level3_label_de, count(distinct m.id)::bigint
  from matched m
  join public.v_course_full_categories v on v.course_id = m.id
  cross join params p
  where v.level1_slug = p.db_segment and v.level2_slug = p.area_slug
  group by v.level3_label_de
  union all
  select 'focus', coalesce(v.level4_label_de, '(ohne Fokus)'), count(distinct m.id)::bigint
  from matched m
  join public.v_course_full_categories v on v.course_id = m.id
  cross join params p
  where v.level1_slug = p.db_segment and v.level2_slug = p.area_slug
  group by coalesce(v.level4_label_de, '(ohne Fokus)')
  union all
  select 'delivery', delivery_type, count(distinct m.id)::bigint
  from matched m
  cross join lateral unnest(coalesce(m.delivery_types, array['unbekannt']::text[])) as delivery_type
  group by delivery_type
  union all
  select 'location', coalesce(cl.canton, '(ohne Kanton)'), count(distinct m.id)::bigint
  from matched m
  left join public.course_locations cl on cl.course_id = m.id
  group by coalesce(cl.canton, '(ohne Kanton)')
  union all
  select 'level', coalesce(nullif(m.level, ''), '(unbekannt)'), count(*)::bigint
  from matched m
  group by coalesce(nullif(m.level, ''), '(unbekannt)')
)
select dimension, label, course_count
from dimensions
order by
  case dimension
    when 'overview' then 1
    when 'specialty' then 2
    when 'focus' then 3
    when 'delivery' then 4
    when 'location' then 5
    when 'level' then 6
    else 99
  end,
  course_count desc,
  label;
