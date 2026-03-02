-- Audit-Trail für Kontaktformular, Verifizierungs-Benachrichtigungen und Kategorie-Vorschläge

CREATE TYPE contact_message_type AS ENUM ('contact', 'verification', 'category-suggestion');
CREATE TYPE contact_message_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type contact_message_type NOT NULL,
  sender_email_hash TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status contact_message_status NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_contact_messages_type ON contact_messages(type);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);
CREATE INDEX idx_contact_messages_email_hash_created ON contact_messages(sender_email_hash, created_at);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Retention: Einträge älter als 365 Tage löschen
CREATE OR REPLACE FUNCTION cleanup_old_contact_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM contact_messages
  WHERE created_at < now() - INTERVAL '365 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
