import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const file = '20260930120000_add_lead_ip_hash.sql';
const path = join(process.cwd(), 'supabase', 'migrations', file);

describe('Migration für den IP-Hash am Lead', () => {
  const sql = () => readFileSync(path, 'utf8').replace(/\s+/g, ' ');

  it('legt die Spalte idempotent an', () => {
    expect(existsSync(path)).toBe(true);
    expect(sql()).toContain('ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS requester_ip_hash TEXT;');
  });

  it('legt den Index für die Stundenabfrage an', () => {
    expect(sql()).toContain('CREATE INDEX IF NOT EXISTS idx_leads_ip_hash_created');
    expect(sql()).toContain('ON public.leads (requester_ip_hash, created_at DESC)');
  });

  it('dokumentiert, dass nie die rohe IP gespeichert wird', () => {
    expect(sql()).toContain('COMMENT ON COLUMN public.leads.requester_ip_hash IS');
    expect(sql()).toMatch(/rohe IP wird nie gespeichert/i);
  });

  it('hält fest, dass der Endpunkt auch ohne die Migration läuft', () => {
    // Migrationen werden von Hand eingespielt. api/send-lead.js überspringt die
    // IP-Stufe, solange die Spalte fehlt — das darf nicht verlorengehen.
    expect(sql()).toMatch(/auch OHNE diese Migration/i);
  });
});
