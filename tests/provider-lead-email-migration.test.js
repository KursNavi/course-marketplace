import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const file = '20260920120000_add_provider_lead_email.sql';
const path = join(process.cwd(), 'supabase', 'migrations', file);

describe('Migration für separate Anbieter-Lead-Adresse', () => {
  it('legt die optionale Spalte auf profiles an', () => {
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, 'utf8').replace(/\s+/g, ' ');

    expect(sql).toContain('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lead_email TEXT;');
    expect(sql).toContain('COMMENT ON COLUMN public.profiles.lead_email IS');
  });
});
