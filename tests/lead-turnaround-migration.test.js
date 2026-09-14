import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913203447_add_lead_turnaround_attribution_and_status.sql'),
  'utf8',
);
const flat = migration.replace(/\s+/g, ' ');

describe('lead turnaround migration', () => {
  it('adds stable conversion, attribution and response fields', () => {
    expect(flat).toContain('event_id UUID NOT NULL DEFAULT gen_random_uuid()');
    expect(flat).toContain('expected_response_by TIMESTAMPTZ');
    expect(flat).toContain('response_status TEXT NOT NULL DEFAULT \'pending\'');
    expect(flat).toContain('attribution_gclid TEXT');
    expect(flat).toContain('requester_confirmation_sent_at TIMESTAMPTZ');
    expect(flat).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_id');
  });

  it('constrains provider response and lead intent values', () => {
    expect(flat).toContain("lead_intent IS NULL OR lead_intent IN ( 'availability', 'price_details', 'advice' )");
    expect(flat).toContain("response_status IN ( 'pending', 'acknowledged', 'qualified', 'not_qualified', 'contacted' )");
  });

  it('does not broaden browser grants or add public policies', () => {
    expect(migration).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]+TO\s+(?:anon|authenticated)/i);
    expect(migration).not.toMatch(/CREATE\s+POLICY/i);
  });
});
