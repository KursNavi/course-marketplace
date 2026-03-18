-- Neue Meta-Felder für Blog-Artikel (SEO & Social Media)
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS social_teaser TEXT;
