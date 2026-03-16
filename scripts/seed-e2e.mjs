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
 *   E2E_PROVIDER_PASSWORD       – (not used by seed, but validated for completeness)
 *   E2E_PROVIDER_ID             – UUID of the teacher auth user
 *   E2E_LEARNER_EMAIL           – email of the student test user
 *   E2E_LEARNER_PASSWORD        – (not used by seed, but validated for completeness)
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
  'E2E_PROVIDER_ID',
  'E2E_LEARNER_EMAIL',
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

const PROVIDER_ID = process.env.E2E_PROVIDER_ID;
const PROVIDER_EMAIL = process.env.E2E_PROVIDER_EMAIL;
const LEARNER_ID = process.env.E2E_LEARNER_ID;
const LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL;

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

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`\nSeeding E2E test data on: ${process.env.SUPABASE_URL_TEST}\n`);

  // 1. Clean up stale E2E data from previous runs
  log('CLEANUP', 'Removing old E2E courses and related data');
  const { data: oldCourses } = await supabase
    .from('courses')
    .select('id')
    .like('title', `${E2E_PREFIX}%`);

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
  await assertOk(
    `Upsert provider profile (${PROVIDER_ID})`,
    await supabase.from('profiles').upsert({
      id: PROVIDER_ID,
      full_name: 'E2E Anbieter',
      email: PROVIDER_EMAIL,
      role: 'teacher',
      package_tier: 'basic',
      preferred_language: 'de',
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

  // 3. Seed a published lead course (for the inquiry / detail-view test)
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
