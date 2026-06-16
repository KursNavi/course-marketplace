-- Patch: instructor_name für alle loveissweet.ch Kurse setzen
-- Liest den Wert aus dem Profil (display_name → full_name → email-Präfix)
-- und schreibt ihn in alle Kurse dieses Anbieters, wo instructor_name noch NULL ist.

UPDATE courses c
SET instructor_name = COALESCE(
  NULLIF(p.full_name, ''),
  split_part(p.email, '@', 1),
  'loveissweet.ch'
)
FROM profiles p
WHERE c.user_id = p.id
  AND c.user_id = '9d587fd1-815d-4c63-9f9b-2b97c5d1e748'
  AND (c.instructor_name IS NULL OR c.instructor_name = '');

-- Verifikation:
SELECT id, title, instructor_name
FROM courses
WHERE user_id = '9d587fd1-815d-4c63-9f9b-2b97c5d1e748'
ORDER BY id DESC
LIMIT 30;
