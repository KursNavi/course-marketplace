#!/usr/bin/env node
/**
 * seed-e2e.mjs — Idempotent seed script for the Supabase test project.
 *
 * Seeds minimal test data required by hybrid app-e2e tests.
 * Safe to run multiple times — all operations use upsert or delete-before-insert.
 *
 * Run: npm run seed:e2e
 *
 * Required env vars:
 *   SUPABASE_URL_TEST           – test project URL
 *   SUPABASE_SECRET_KEY_TEST    – test project service_role key
 *   E2E_PROVIDER_EMAIL          – email of the teacher test user (already in auth.users)
 *   E2E_PROVIDER_PASSWORD       – password to keep in sync on the test user
 *   E2E_PROVIDER_ID             – UUID of the teacher auth user
 *   E2E_LEARNER_EMAIL           – email of the student test user
 *   E2E_LEARNER_PASSWORD        – password to keep in sync on the test user
 *   E2E_LEARNER_ID              – UUID of the student auth user
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.test.local' });

// ── Env validation ──────────────────────────────────────────────
const REQUIRED_ENV = [
  'SUPABASE_URL_TEST',
  'SUPABASE_PUBLISHABLE_KEY_TEST',
  'SUPABASE_SECRET_KEY_TEST',
  'E2E_PROVIDER_EMAIL',
  'E2E_PROVIDER_PASSWORD',
  'E2E_PROVIDER_ID',
  'E2E_LEARNER_EMAIL',
  'E2E_LEARNER_PASSWORD',
  'E2E_LEARNER_ID',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`ERROR: Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// Use secret key as both apikey and implicit Bearer token.
// The Supabase API gateway resolves sb_secret_ keys to service_role.
const supabase = createClient(
  process.env.SUPABASE_URL_TEST,
  process.env.SUPABASE_SECRET_KEY_TEST,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const CONFIGURED_PROVIDER_ID = process.env.E2E_PROVIDER_ID;
const PROVIDER_EMAIL = process.env.E2E_PROVIDER_EMAIL;
const CONFIGURED_LEARNER_ID = process.env.E2E_LEARNER_ID;
const LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL;

let PROVIDER_ID;
let LEARNER_ID;

// Prefix for all E2E-created data — used for cleanup
const E2E_PREFIX = 'E2E-';

// ── Helper ──────────────────────────────────────────────────────
function log(action, detail) {
  console.log(`  [seed] ${action}: ${detail}`);
}

async function assertOk(label, result) {
  if (result.error) {
    console.error(`  [seed] FAILED ${label}:`, result.error.message);
    throw new Error(`Seed failed at: ${label}`);
  }
  log('OK', label);
  return result.data;
}

async function resolveAuthUserId(email, configuredId, label) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw new Error(`Could not load ${label} test user: ${error.message}`);
  }

  const user = data.users.find(candidate => candidate.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error(`Could not find ${label} test user for ${email}`);
  }

  if (configuredId && configuredId !== user.id) {
    console.warn(`  [seed] WARNING: Configured ${label} ID does not match the Auth user found by email; using the Auth user ID.`);
  }

  return user.id;
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`\nSeeding E2E test data on: ${process.env.SUPABASE_URL_TEST}\n`);

  // The email is the source of truth. This avoids orphan profiles when a test
  // user's Auth ID changed after a manual recreation or password reset.
  PROVIDER_ID = await resolveAuthUserId(PROVIDER_EMAIL, CONFIGURED_PROVIDER_ID, 'provider');
  LEARNER_ID = await resolveAuthUserId(LEARNER_EMAIL, CONFIGURED_LEARNER_ID, 'learner');

  // 0. Schema-Check: verify that all required columns exist on the test DB.
  //    Columns added via migration files must be applied to the test project before tests run.
  log('CHECK', 'Schema column: courses.price_info');
  {
    const { error } = await supabase.from('courses').select('price_info').limit(1);
    if (error && error.message?.includes('price_info')) {
      console.warn('\n  [seed] WARNING: Column "price_info" is missing from the test Supabase project.');
      console.warn('  [seed] Please run the following SQL in the Supabase Dashboard SQL Editor:');
      console.warn('  [seed]   https://supabase.com/dashboard/project/omoapbvfligjfznzivyu/sql');
      console.warn('  [seed]   SQL: ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_info TEXT;');
      console.warn('  [seed]   (see: supabase/migrations/20260510_add_price_info_to_courses.sql)');
      console.warn('  [seed] Continuing seed — tests affected by this will skip automatically.\n');
    } else {
      log('OK', 'Column courses.price_info exists');
    }
  }

  // 1. Clean up stale E2E data from previous runs
  //
  // Gesucht wird das Präfix ÜBERALL im Titel, nicht nur am Anfang, und zusätzlich
  // jede "Kopie von"-Kette. Die frühere Bedingung (`E2E-%` oder
  // `Kopie von E2E-%`) traf genau eine Kopierstufe. "Kopie von Kopie von E2E-…"
  // fiel durch — solche Ketten blieben liegen und wuchsen bei jedem Lauf um eine
  // weitere Stufe, bis der Titel über 1400 Zeichen lang war.
  log('CLEANUP', 'Removing old E2E courses and related data');
  const { data: cleanupCandidates } = await supabase
    .from('courses')
    .select('id, title')
    .or(`title.like.%${E2E_PREFIX}%,title.like.Kopie von %`);

  // Ausnahme: Vorrichtungen, die dieses Skript NICHT selbst wieder anlegt.
  // Sie wurden von Hand erstellt und wären nach dem Löschen unwiederbringlich.
  // Wer eine davon seed-fähig macht, kann sie hier streichen.
  const KEEP_TITLES = new Set(['Platform E2E-Testkurs']);
  const oldCourses = (cleanupCandidates || []).filter(c => !KEEP_TITLES.has(c.title));

  if (oldCourses?.length) {
    const ids = oldCourses.map(c => c.id);
    // course_events, bookings, course_category_assignments cascade on delete
    await assertOk(
      `Delete ${ids.length} old E2E course(s)`,
      await supabase.from('courses').delete().in('id', ids)
    );
  } else {
    log('SKIP', 'No old E2E courses found');
  }

  // 2. Upsert profiles for test users
  // profiles.id = auth.users.id (confirmed via handle_new_user trigger + app code)
  // verification_status='verified' + is_professional=true → fetchVerifiedProvider() finds this profile.
  // slug + profile_published_at → appears in the public ProviderDirectory listing.
  const { data: existingProviderProfile, error: existingProviderProfileError } = await supabase
    .from('profiles')
    .select('package_tier')
    .eq('id', PROVIDER_ID)
    .maybeSingle();
  if (existingProviderProfileError) {
    throw new Error(`Could not load provider profile before seeding: ${existingProviderProfileError.message}`);
  }

  await assertOk(
    `Upsert provider profile (${PROVIDER_ID})`,
    await supabase.from('profiles').upsert({
      id: PROVIDER_ID,
      full_name: 'E2E Anbieter',
      email: PROVIDER_EMAIL,
      role: 'teacher',
      // Preserve the configured test user's package so seeding cannot downgrade
      // an existing shared test account (for example Premium → Pro).
      package_tier: existingProviderProfile?.package_tier || 'pro',
      preferred_language: 'de',
      is_professional: true,
      verification_status: 'verified',
      slug: 'e2e-seed-anbieter',
      profile_published_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  );

  await assertOk(
    `Upsert learner profile (${LEARNER_ID})`,
    await supabase.from('profiles').upsert({
      id: LEARNER_ID,
      full_name: 'E2E Lernende',
      email: LEARNER_EMAIL,
      role: 'student',
      package_tier: 'basic',
      preferred_language: 'de',
    }, { onConflict: 'id' })
  );

  // 2b. Keep Auth passwords in sync with the CI secrets. This makes the test users
  //     deterministic even after a manual password reset in the shared test project.
  //     The seed already requires a service-role-compatible key for its database writes.
  {
    const { error } = await supabase.auth.admin.updateUserById(PROVIDER_ID, {
      password: process.env.E2E_PROVIDER_PASSWORD,
      user_metadata: { role: 'teacher' },
    });
    if (error) {
      throw new Error(`Could not synchronize provider test user: ${error.message}`);
    } else {
      log('OK', 'Synchronized provider test user password and role');
    }
  }

  {
    const { error } = await supabase.auth.admin.updateUserById(LEARNER_ID, {
      password: process.env.E2E_LEARNER_PASSWORD,
    });
    if (error) {
      throw new Error(`Could not synchronize learner test user: ${error.message}`);
    } else {
      log('OK', 'Synchronized learner test user password');
    }
  }

  // 3. Seed a published lead course (for the inquiry / detail-view test)
  // is_pro=true → fetchVerifiedCourse() finds this course; also exercises the Verifiziert filter.
  const seedCourse = await assertOk(
    'Insert seed course (E2E-Seed Testkurs)',
    await supabase.from('courses').insert({
      title: 'E2E-Seed Testkurs',
      price: 150,
      languages: ['Deutsch'],
      category: 'professionell | sport_fitness_beruf',
      category_type: 'professionell',
      category_area: 'sport_fitness_beruf',
      category_specialty: 'Fitness Trainer Ausbildung',
      booking_type: 'lead',
      delivery_types: ['vor_ort'],
      canton: 'Zürich',
      address: 'Zürich',
      description: 'Automatisch erstellter Testkurs für E2E-Tests. Wird bei jedem Seed-Lauf neu erstellt.',
      user_id: PROVIDER_ID,
      status: 'published',
      is_pro: true,
    }).select('id').single()
  );

  // 4. Seed a course event for the test course (future date)
  if (seedCourse?.id) {
    await assertOk(
      `Insert course event for seed course (id=${seedCourse.id})`,
      await supabase.from('course_events').insert({
        course_id: seedCourse.id,
        start_date: '2099-06-01',
        location: 'Zürich',
        canton: 'Zürich',
        schedule_description: 'Mo-Fr 09:00-17:00',
        max_participants: 20,
      })
    );
  }

  // 5. Ensure storage buckets exist
  log('CHECK', 'Storage buckets');
  for (const bucket of ['course-images', 'certificates']) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: bucket === 'course-images', // course-images is public, certificates is private
    });
    if (error && !error.message?.includes('already exists')) {
      console.error(`  [seed] WARNING: Could not create bucket '${bucket}': ${error.message}`);
    } else {
      log('OK', `Bucket '${bucket}' ensured`);
    }
  }

  console.log('\nE2E seed complete.\n');
}

main().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});

