-- KursNavi Themenwelt-Workflow: vollständiger Angebots-Snapshot
-- Nur den params-Block anpassen. Diese Abfrage ist read-only.
-- Ergebnis unverändert als 01-angebot/02-kurse.csv speichern.

with params as (
  select
    'privat'::text as db_segment,
    'yoga_achtsamkeit'::text as area_slug
),
matched_course_ids as (
  select distinct v.course_id
  from public.v_course_full_categories v
  cross join params p
  where v.level1_slug = p.db_segment
    and v.level2_slug = p.area_slug
)
select
  c.id as course_id,
  c.title,
  c.instructor_name,
  p.slug as provider_slug,
  p.verification_status as provider_verification_status,
  p.certificates as provider_certificates,
  c.description,
  c.objectives,
  c.prerequisites,
  c.keywords,
  c.level,
  c.target_group,
  c.target_age_groups,
  c.min_age,
  c.price,
  c.price_info,
  c.session_count,
  c.session_length,
  c.languages,
  c.delivery_types,
  c.privat_kursart,
  c.kinder_kursart,
  c.beruf_saeulen,
  c.booking_type,
  c.provider_url,
  c.external_link,
  c.canton as legacy_canton,
  c.created_at,
  categories.all_categories,
  locations.course_locations,
  events.active_events
from matched_course_ids m
join public.courses c on c.id = m.course_id
left join public.profiles p on p.id = c.user_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'is_primary', v.is_primary,
      'type_slug', v.level1_slug,
      'type_label', v.level1_label_de,
      'area_slug', v.level2_slug,
      'area_label', v.level2_label_de,
      'specialty_slug', v.level3_slug,
      'specialty_label', v.level3_label_de,
      'focus_slug', v.level4_slug,
      'focus_label', v.level4_label_de
    )
    order by v.is_primary desc, v.level3_label_de, v.level4_label_de nulls first
  ) as all_categories
  from public.v_course_full_categories v
  where v.course_id = c.id
) categories on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'location_type', cl.location_type,
      'street', cl.street,
      'city', cl.city,
      'canton', cl.canton
    )
    order by cl.sort_order, cl.city nulls last
  ) as course_locations
  from public.course_locations cl
  where cl.course_id = c.id
) locations on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'start_date', ce.start_date,
      'end_date', ce.end_date,
      'location', ce.location,
      'canton', ce.canton,
      'schedule_description', ce.schedule_description
    )
    order by ce.start_date nulls last
  ) as active_events
  from public.course_events ce
  where ce.course_id = c.id
    and ce.cancelled_at is null
) events on true
where c.status = 'published'
order by c.title, c.id;
