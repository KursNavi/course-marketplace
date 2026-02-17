-- Export IFFP Kurse für Anbieter-Review
-- Ausgabe: Titel | Beschreibung | Lernziele (als nummerierte Liste)
-- Format: Tab-separiert für einfaches Kopieren in Excel/Google Sheets

SELECT
    title AS "Titel",
    description AS "Beschreibung",
    array_to_string(objectives, E'\n') AS "Lernziele"
FROM courses
WHERE user_id = '9feacc90-d14e-4def-b160-d2f2648b6cc2'
ORDER BY title;

-- Alternative: CSV-Format mit Semikolon-Trennung (für deutsche Excel-Versionen)
-- COPY (
--     SELECT
--         title,
--         description,
--         array_to_string(objectives, ' | ') AS objectives
--     FROM courses
--     WHERE user_id = '9feacc90-d14e-4def-b160-d2f2648b6cc2'
--     ORDER BY title
-- ) TO STDOUT WITH CSV HEADER DELIMITER ';';
