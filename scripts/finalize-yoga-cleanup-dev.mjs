#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

const env = loadEnv('.env.vercel');
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ACTIVE_L3 = [
  'yoga',
  'meditation_achtsamkeit',
  'atemarbeit',
  'klang_mantra',
  'somatics_koerperbewusstsein',
  'energiearbeit',
  'bodywork_massage',
];

const L3_TO_DELETE = [
  'mental_health',
  'mental_meditation',
  'koerperarbeit',
  'personlichkeitsentwicklung',
  'persoenlichkeitsentwicklung',
  'persoenlichkeit',
];

const ALLOWED_L4 = {
  yoga: [
    'hatha_grundlagen',
    'vinyasa_flow',
    'yin_restorative',
    'power_ashtanga',
    'kundalini',
    'alignment_iyengar_ausrichtung',
    'therapeutisches_yoga',
    'wasser_sup_yoga',
    'hot_yoga',
    'aerial_acro_chair',
  ],
  meditation_achtsamkeit: [
    'achtsamkeitstraining_mbsr_alltag',
    'gefuehrte_meditation',
    'stille_meditation',
    'yoga_nidra',
    'metta_selbstmitgefuehl',
  ],
  atemarbeit: ['pranayama', 'breathwork', 'atemreise'],
  klang_mantra: [
    'klangmeditation_sound_bath',
    'gong_klanginstrumente',
    'mantra_kirtan',
    'klangreise',
    'rhythmus_trommeln',
  ],
  somatics_koerperbewusstsein: [
    'feldenkrais',
    'pilates_yoga_pilates',
    'embodiment_somatic_movement',
    'faszien_mobility',
    'entspannungsverfahren_pmr_autogen',
  ],
  energiearbeit: ['reiki', 'chakra_energiezentren', 'energieheilung_healing'],
  bodywork_massage: ['thai_yoga_massage', 'massage_wellness', 'koerpertherapie'],
};

const LEGACY_L4 = [
  'hatha_flow_vinyasa',
  'wasser_yoga',
  'meditation_achtsamkeit',
  'klang_atemreise',
  'reiki_chakra',
  'feldenkrais_pilates',
  'resilienz_coaching',
  'kausaltraining',
];

async function chunkedUpdate(ids, table, payload) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error } = await supabase.from(table).update(payload).in('id', chunk);
    if (error) throw error;
  }
}

async function main() {
  const { data: l2, error: l2Err } = await supabase
    .from('taxonomy_level2')
    .select('id')
    .eq('slug', 'yoga_achtsamkeit')
    .single();
  if (l2Err || !l2) throw new Error('taxonomy_level2 slug=yoga_achtsamkeit not found');

  const level2Id = l2.id;

  const { data: l3Rows, error: l3Err } = await supabase
    .from('taxonomy_level3')
    .select('id,slug,is_active')
    .eq('level2_id', level2Id);
  if (l3Err) throw l3Err;

  // 1) Target active set on level3
  for (const row of l3Rows || []) {
    const shouldActive = ACTIVE_L3.includes(row.slug);
    if (Boolean(row.is_active) !== shouldActive) {
      const { error } = await supabase
        .from('taxonomy_level3')
        .update({ is_active: shouldActive, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
    }
  }

  // 2) Delete obsolete level3 nodes physically
  const toDeleteL3 = (l3Rows || []).filter((r) => L3_TO_DELETE.includes(r.slug)).map((r) => r.id);
  if (toDeleteL3.length > 0) {
    const { error } = await supabase.from('taxonomy_level3').delete().in('id', toDeleteL3);
    if (error) throw error;
  }

  // Reload level3 after deletes
  const { data: l3After, error: l3AfterErr } = await supabase
    .from('taxonomy_level3')
    .select('id,slug,is_active')
    .eq('level2_id', level2Id);
  if (l3AfterErr) throw l3AfterErr;

  const l3Map = new Map((l3After || []).map((r) => [r.id, r.slug]));
  const l3Ids = [...l3Map.keys()];

  // 3) Delete legacy level4 residuals
  const { data: l4Rows, error: l4Err } = await supabase
    .from('taxonomy_level4')
    .select('id,slug,level3_id,is_active')
    .in('level3_id', l3Ids);
  if (l4Err) throw l4Err;

  const toDeleteL4 = (l4Rows || [])
    .filter((l4) => {
      const l3Slug = l3Map.get(l4.level3_id);
      return (
        LEGACY_L4.includes(l4.slug) ||
        (l4.slug === 'yoga_nidra' && l3Slug === 'yoga') ||
        (l4.slug === 'massage_wellness' && l3Slug === 'somatics_koerperbewusstsein')
      );
    })
    .map((r) => r.id);

  if (toDeleteL4.length > 0) {
    const { error } = await supabase.from('taxonomy_level4').delete().in('id', toDeleteL4);
    if (error) throw error;
  }

  // Reload level4 after deletes
  const { data: l4After, error: l4AfterErr } = await supabase
    .from('taxonomy_level4')
    .select('id,slug,level3_id,is_active')
    .in('level3_id', l3Ids);
  if (l4AfterErr) throw l4AfterErr;

  // 4) Enforce active flags for allowed level4 sets
  const updates = [];
  for (const row of l4After || []) {
    const l3Slug = l3Map.get(row.level3_id);
    const allowed = ALLOWED_L4[l3Slug] || [];
    const shouldActive = allowed.includes(row.slug);
    if (Boolean(row.is_active) !== shouldActive) {
      updates.push({ id: row.id, shouldActive });
    }
  }

  const toActive = updates.filter((u) => u.shouldActive).map((u) => u.id);
  const toInactive = updates.filter((u) => !u.shouldActive).map((u) => u.id);
  if (toActive.length) {
    await chunkedUpdate(toActive, 'taxonomy_level4', {
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  }
  if (toInactive.length) {
    await chunkedUpdate(toInactive, 'taxonomy_level4', {
      is_active: false,
      updated_at: new Date().toISOString(),
    });
  }

  // 5) Refresh taxonomy paths if available
  const { error: refreshErr } = await supabase.rpc('refresh_taxonomy_paths_manual');
  if (refreshErr) {
    console.warn(`refresh_taxonomy_paths_manual failed: ${refreshErr.message}`);
  }

  // Verification
  const { data: verifyL3, error: v3Err } = await supabase
    .from('taxonomy_level3')
    .select('slug,is_active')
    .eq('level2_id', level2Id);
  if (v3Err) throw v3Err;

  const activeL3 = (verifyL3 || []).filter((r) => r.is_active).map((r) => r.slug).sort();
  const missing = ACTIVE_L3.filter((s) => !activeL3.includes(s));
  const extras = activeL3.filter((s) => !ACTIVE_L3.includes(s));

  console.log(
    JSON.stringify(
      {
        ok: missing.length === 0 && extras.length === 0,
        level2: 'yoga_achtsamkeit',
        activeLevel3: activeL3,
        missingRequired: missing,
        unexpectedActive: extras,
        deletedLevel3: toDeleteL3.length,
        deletedLegacyLevel4: toDeleteL4.length,
        level4Activated: toActive.length,
        level4Deactivated: toInactive.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
