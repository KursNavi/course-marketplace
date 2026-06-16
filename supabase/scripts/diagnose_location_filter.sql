-- Diagnose: Welche Kurse haben canton = 'Ausland' oder 'Online'?
-- Zeigt Kurs-Titel, canton, address und ob Termine/Standorte diese Werte haben.

SELECT
    c.id,
    c.title,
    c.booking_type,
    c.canton        AS courses_canton,
    c.address       AS courses_address,
    -- Events mit Ausland oder Online als Kanton
    (
        SELECT string_agg(DISTINCT e.canton, ', ')
        FROM course_events e
        WHERE e.course_id = c.id
          AND e.canton IN ('Ausland', 'Online')
    )               AS event_cantons_special,
    -- course_locations mit Typ ausland oder online
    (
        SELECT string_agg(DISTINCT cl.location_type, ', ')
        FROM course_locations cl
        WHERE cl.course_id = c.id
          AND cl.location_type IN ('ausland', 'online')
    )               AS location_types_special
FROM courses c
WHERE
    c.canton IN ('Ausland', 'Online')
    OR c.address IN ('Ausland', 'Online')
    OR c.id IN (
        SELECT DISTINCT course_id FROM course_events
        WHERE canton IN ('Ausland', 'Online')
    )
    OR c.id IN (
        SELECT DISTINCT course_id FROM course_locations
        WHERE location_type IN ('ausland', 'online')
    )
ORDER BY c.booking_type, c.title;
