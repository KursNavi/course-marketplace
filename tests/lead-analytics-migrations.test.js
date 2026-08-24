/**
 * Invarianten der Lead-Analyse-Migrationen.
 *
 * REICHWEITE DIESER TESTS — bitte lesen, bevor man sich auf sie verlässt:
 * Es steht in dieser Umgebung keine Testdatenbank zur Verfügung, deshalb wird
 * das SQL nicht ausgeführt. Geprüft wird der Migrationsinhalt strukturell.
 *
 * Das ist kein Ersatz für einen Lauf gegen Postgres, aber ein echter
 * Regressionsschutz für genau die Eigenschaften, deren Verlust stillschweigend
 * Daten vernichten oder das Ranking verfälschen würde:
 *   - Leads werden nicht mehr gelöscht,
 *   - eine Kurslöschung nimmt die Leadhistorie nicht mit,
 *   - der Retention-Lauf entfernt nur Texte und Hashes,
 *   - jeder Paketwechsel wird historisiert, egal über welchen Pfad,
 *   - es kann höchstens eine offene Paketperiode geben,
 *   - die Zählregel der Penalty bleibt vollständig.
 *
 * Vor der Produktivsetzung müssen die Migrationen zusätzlich einmal gegen eine
 * echte Postgres-Instanz gefahren werden (siehe docs/lead-analytics.md).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), 'supabase', 'migrations');

const FILES = {
  leads: '20260824_lead_quality_extend_leads.sql',
  payloads: '20260824_lead_message_payloads.sql',
  history: '20260824_provider_package_history.sql',
  factor: '20260824_basic_lead_ranking_factor.sql',
  rpc: '20260824_admin_lead_analytics_rpc.sql',
  delivery: '20260824_lead_email_delivery_status.sql',
};

const sql = Object.fromEntries(
  Object.entries(FILES).map(([key, file]) => [key, readFileSync(join(DIR, file), 'utf8')])
);

/** Normalisiert Whitespace, damit Zeilenumbrüche keine Prüfung sprengen. */
const flat = (text) => text.replace(/\s+/g, ' ');

describe('Alle Migrationsdateien vorhanden', () => {
  it.each(Object.entries(FILES))('%s existiert', (_key, file) => {
    expect(existsSync(join(DIR, file))).toBe(true);
  });
});

describe('leads: Historie bleibt erhalten', () => {
  it('macht course_id nullable mit ON DELETE SET NULL', () => {
    expect(flat(sql.leads)).toContain('ALTER COLUMN course_id DROP NOT NULL');
    expect(flat(sql.leads)).toContain('REFERENCES courses(id) ON DELETE SET NULL');
  });

  it('lässt kein ON DELETE CASCADE mehr auf course_id zu', () => {
    expect(flat(sql.leads)).not.toMatch(/course_id\) REFERENCES courses\(id\) ON DELETE CASCADE/);
  });

  it('entschärft den alten 180-Tage-Cleanup vollständig', () => {
    // Entscheidend: Die neue Fassung von cleanup_old_leads() darf nirgends
    // mehr aus leads löschen.
    expect(sql.leads).not.toMatch(/DELETE\s+FROM\s+leads/i);
    expect(sql.leads).not.toContain("INTERVAL '180 days'");
    expect(flat(sql.leads)).toContain('CREATE OR REPLACE FUNCTION cleanup_old_leads()');
  });
});

describe('leads: Qualitätsfelder', () => {
  it('begrenzt quality_score auf 1 bis 10', () => {
    expect(flat(sql.leads)).toContain('CHECK (quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 10))');
  });

  it('kennt genau die vier Zustände', () => {
    expect(flat(sql.leads)).toContain("CHECK (quality_status IN ('pending', 'scored', 'failed', 'expired_unscored'))");
  });

  it('erzwingt, dass ein bewerteter Lead auch einen Score trägt', () => {
    expect(flat(sql.leads)).toContain("quality_status = 'scored' AND quality_score IS NOT NULL");
  });

  it('erlaubt beim Paket-Snapshot nur die vier bekannten Werte plus NULL', () => {
    expect(flat(sql.leads)).toContain("provider_tier_at_lead IN ('basic', 'pro', 'premium', 'enterprise')");
    expect(flat(sql.leads)).toContain('provider_tier_at_lead IS NULL');
  });

  it('macht requester_email_hash für die Datensparsamkeit nullable', () => {
    expect(flat(sql.leads)).toContain('ALTER COLUMN requester_email_hash DROP NOT NULL');
  });

  it('legt den geforderten Index (provider_id, created_at) an', () => {
    expect(flat(sql.leads)).toContain('ON leads (provider_id, created_at DESC)');
  });
});

describe('Anfragetext: Zugriff und Retention', () => {
  it('sperrt die Payload-Tabelle für anon und authenticated', () => {
    expect(flat(sql.payloads)).toContain('ALTER TABLE lead_message_payloads ENABLE ROW LEVEL SECURITY');
    expect(flat(sql.payloads)).toContain('REVOKE ALL ON lead_message_payloads FROM anon, authenticated');
  });

  it('vergibt keine SELECT-Policy auf der Payload-Tabelle', () => {
    expect(sql.payloads).not.toMatch(/CREATE POLICY[\s\S]*lead_message_payloads/i);
  });

  it('setzt die Frist auf 60 Tage', () => {
    expect(flat(sql.payloads)).toContain("now() + INTERVAL '60 days'");
  });

  it('löscht im Retention-Lauf nur Nachrichtentexte, niemals Leads', () => {
    expect(flat(sql.payloads)).toContain('DELETE FROM lead_message_payloads WHERE expires_at <= now()');
    expect(sql.payloads).not.toMatch(/DELETE\s+FROM\s+leads/i);
  });

  it('leert den E-Mail-Hash nach 60 Tagen, ohne die Zeile zu entfernen', () => {
    const text = flat(sql.payloads);
    expect(text).toContain('UPDATE leads SET requester_email_hash = NULL');
    expect(text).toContain("created_at < now() - INTERVAL '60 days'");
  });

  it('markiert unbewertbar gewordene Leads mit Karenzzeit', () => {
    const text = flat(sql.payloads);
    expect(text).toContain("SET quality_status = 'expired_unscored'");
    expect(text).toContain("l.created_at < now() - INTERVAL '1 hour'");
  });
});

describe('Paketverlauf: kein Änderungspfad kann vergessen werden', () => {
  it('hängt die Historisierung an profiles, nicht an einzelne API-Pfade', () => {
    const text = flat(sql.history);
    expect(text).toContain('AFTER INSERT OR UPDATE OF package_tier ON profiles');
    expect(text).toContain('EXECUTE FUNCTION track_package_tier_change()');
  });

  it('pflegt package_started_at im selben Schreibvorgang', () => {
    const text = flat(sql.history);
    expect(text).toContain('BEFORE INSERT OR UPDATE OF package_tier ON profiles');
    expect(text).toContain('EXECUTE FUNCTION set_package_started_at()');
  });

  it('schliesst die offene Periode, bevor eine neue eröffnet wird', () => {
    const text = flat(sql.history);
    const close = text.indexOf('SET ended_at = v_started');
    const open = text.indexOf('INSERT INTO provider_package_history (provider_id, package_tier, started_at, start_is_estimated, change_source) VALUES');
    expect(close).toBeGreaterThan(-1);
    expect(open).toBeGreaterThan(close);
  });

  it('verhindert überlappende offene Perioden per Unique-Index', () => {
    expect(flat(sql.history)).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_package_open_period ON provider_package_history (provider_id) WHERE ended_at IS NULL');
  });

  it('eröffnet keine neue Periode, wenn sich das Paket nicht geändert hat', () => {
    expect(flat(sql.history)).toContain("IF lower(coalesce(OLD.package_tier, 'basic')) = v_new THEN RETURN NULL");
  });

  it('kennzeichnet Backfill-Startpunkte als geschätzt', () => {
    const text = flat(sql.history);
    expect(text).toContain("true, 'backfill'");
    expect(text).toContain('start_is_estimated BOOLEAN NOT NULL DEFAULT false');
  });
});

describe('Ranking-Penalty: Zählregel und Staffel', () => {
  it('bildet die Staffel exakt ab', () => {
    const text = flat(sql.factor);
    expect(text).toContain('WHEN coalesce(p_count, 0) >= 11 THEN 0.70');
    expect(text).toContain('WHEN coalesce(p_count, 0) >= 7 THEN 0.80');
    expect(text).toContain('WHEN coalesce(p_count, 0) >= 4 THEN 0.90');
    expect(text).toContain('ELSE 1.00');
  });

  it('zählt nur versandte, qualifizierte Basic-Leads der aktuellen Phase', () => {
    const text = flat(sql.factor);
    expect(text).toContain("l.status = 'sent'");
    expect(text).toContain("l.provider_tier_at_lead = 'basic'");
    expect(text).toContain('l.quality_score >= 5');
    expect(text).toContain('l.created_at >= b.started_at');
  });

  it('bestimmt die aktuelle Basic-Phase über die offene Periode', () => {
    const text = flat(sql.factor);
    expect(text).toContain('CREATE OR REPLACE FUNCTION current_basic_phase_start');
    expect(text).toContain("h.ended_at IS NULL AND h.package_tier = 'basic'");
  });

  it('gibt allen Nicht-Basic-Anbietern den Faktor 1.00', () => {
    expect(flat(sql.factor)).toContain('WHEN q.provider_id IS NULL THEN 1.00');
  });

  it('setzt die Penalty bei jedem Paketwechsel sofort zurück', () => {
    const text = flat(sql.factor);
    expect(text).toContain('NEW.basic_lead_ranking_factor := 1.00');
    expect(text).toContain('BEFORE INSERT OR UPDATE OF package_tier ON profiles');
  });

  it('rechnet mengenbasiert statt in einer Schleife', () => {
    expect(flat(sql.factor)).toContain('UPDATE profiles p SET basic_lead_ranking_factor = t.factor FROM target t');
    expect(sql.factor).not.toMatch(/FOR\s+\w+\s+IN\s+SELECT/i);
  });
});

describe('Admin-Auswertungen: minimale Rechte', () => {
  it('entzieht anon und authenticated alle Ausführungsrechte', () => {
    const text = flat(sql.rpc);
    for (const fn of ['admin_provider_lead_overview', 'admin_provider_lead_detail', 'admin_provider_leads']) {
      expect(text).toMatch(new RegExp(`REVOKE ALL ON FUNCTION ${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
      expect(text).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}\\([^)]*\\) TO service_role`));
    }
  });

  it('setzt search_path in jeder SECURITY-DEFINER-Funktion', () => {
    // Nur echte Deklarationen zählen — die stehen am Zeilenanfang. Ein
    // "SECURITY DEFINER" im Kommentarkopf ist keine Funktion.
    const definers = sql.rpc.match(/^SECURITY DEFINER$/gm) || [];
    const searchPaths = sql.rpc.match(/^SET search_path = public$/gm) || [];
    expect(definers.length).toBeGreaterThan(0);
    expect(searchPaths.length).toBe(definers.length);
  });

  it('löst die Sortierung über CASE statt über dynamisches SQL auf', () => {
    // EXECUTE mit zusammengesetztem String wäre der Injection-Weg.
    expect(sql.rpc).not.toMatch(/EXECUTE\s+format\(/i);
    expect(sql.rpc).not.toMatch(/EXECUTE\s+'/);
    expect(flat(sql.rpc)).toContain('CASE v_sort');
  });

  it('begrenzt limit und offset auch in SQL', () => {
    const text = flat(sql.rpc);
    expect(text).toContain('least(greatest(coalesce(p_limit, 25), 1), 200)');
    expect(text).toContain('greatest(coalesce(p_offset, 0), 0)');
  });

  it('lässt nur bekannte Sortierschlüssel zu', () => {
    expect(flat(sql.rpc)).toContain("v_sort := 'leads_total'");
  });
});

describe('E-Mail-Zustellung: Annahme und Zustellung getrennt', () => {
  it('hält historische Zustellstatus bewusst auf unknown', () => {
    expect(flat(sql.delivery)).toContain("DEFAULT 'unknown'");
    expect(flat(sql.delivery)).toContain("'accepted'");
    expect(flat(sql.delivery)).toContain("'delivered'");
    expect(flat(sql.delivery)).toContain("'bounced'");
  });

  it('speichert nur die Resend-ID und keine Nachrichtendaten', () => {
    expect(flat(sql.delivery)).toContain('email_provider_message_id TEXT');
    expect(flat(sql.delivery)).toContain('idx_leads_email_provider_message_id');
    expect(flat(sql.delivery)).not.toContain('ciphertext');
  });

  it('liefert den Zustellstatus in der geschützten Leadliste aus', () => {
    expect(flat(sql.delivery)).toContain('email_delivery_status TEXT');
    expect(flat(sql.delivery)).toContain('email_delivery_updated_at TIMESTAMPTZ');
    expect(flat(sql.delivery)).toContain('email_delivery_error_code TEXT');
    expect(flat(sql.delivery)).toContain('l.email_delivery_status');
  });
});
