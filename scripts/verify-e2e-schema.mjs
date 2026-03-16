#!/usr/bin/env node
/**
 * verify-e2e-schema.mjs
 *
 * Checks that the Supabase test project has all tables required by the app.
 * Run: npm run verify:e2e-schema
 *
 * Env vars required:
 *   SUPABASE_URL_TEST          – test project URL
 *   SUPABASE_SECRET_KEY_TEST   – test project service_role key
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.test.local' });

const url = process.env.SUPABASE_URL_TEST;
const key = process.env.SUPABASE_SECRET_KEY_TEST;

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL_TEST and SUPABASE_SECRET_KEY_TEST must be set.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Tables that the app requires (core + e2e-relevant)
const REQUIRED_TABLES = [
  'profiles',
  'courses',
  'course_events',
  'bookings',
  'course_category_assignments',
  'taxonomy_level1',
  'taxonomy_level2',
  'taxonomy_level3',
  'taxonomy_level4',
  'course_views',
  'leads',
  'contact_messages',
  'credit_transactions',
  'saved_courses',
  'ticket_periods',
  'provider_slug_aliases',
  // capture_service_requests is used by the capture-service checkout flow
  // (not created by migrations — may have been added manually)
  'capture_service_requests',
];

// Views
const REQUIRED_VIEWS = [
  'v_course_full_categories',
];

async function checkTable(name) {
  // Use a lightweight query — select 0 rows, rely on error to detect missing table
  const { error } = await supabase.from(name).select('*', { count: 'exact', head: true });
  if (error) {
    // PostgREST returns 404 or a message containing "relation" for missing tables
    if (error.message?.includes('relation') || error.code === '42P01' || error.code === 'PGRST204') {
      return { name, exists: false, note: error.message };
    }
    // RLS may block the query but the table still exists — count the error differently
    if (error.code === '42501' || error.message?.includes('permission')) {
      return { name, exists: true, note: 'exists (RLS may restrict access)' };
    }
    return { name, exists: false, note: error.message };
  }
  return { name, exists: true };
}

async function main() {
  console.log(`\nVerifying E2E schema on: ${url}\n`);

  const allChecks = [...REQUIRED_TABLES, ...REQUIRED_VIEWS];
  const results = await Promise.all(allChecks.map(checkTable));

  const missing = results.filter(r => !r.exists);
  const present = results.filter(r => r.exists);

  for (const r of present) {
    console.log(`  OK   ${r.name}${r.note ? ` (${r.note})` : ''}`);
  }
  for (const r of missing) {
    console.log(`  MISS ${r.name} — ${r.note || 'not found'}`);
  }

  console.log(`\n${present.length}/${allChecks.length} tables/views found.`);

  if (missing.length > 0) {
    console.error(
      `\nERROR: ${missing.length} required table(s)/view(s) missing.\n` +
      'The test project schema is incomplete.\n\n' +
      'To fix this:\n' +
      '  1. Export the schema from your production Supabase project\n' +
      '     (Dashboard → SQL Editor → run: pg_dump commands, or use supabase db dump)\n' +
      '  2. Apply the schema SQL to the test project\n' +
      '  3. Re-run: npm run verify:e2e-schema\n'
    );
    process.exit(1);
  }

  console.log('\nAll required tables and views are present. Schema OK.\n');
}

main().catch(err => {
  console.error('Schema verification failed:', err);
  process.exit(1);
});
