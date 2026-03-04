#!/usr/bin/env node
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

async function fetchAll(table, select, filterFn) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function one(table, filterFn, select = '*') {
  let q = supabase.from(table).select(select);
  q = filterFn(q);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function ensureL3(level2Id, slug, label, sortOrder, active = true) {
  const row = await one('taxonomy_level3', (q) => q.eq('level2_id', level2Id).eq('slug', slug));
  if (row) {
    const { error } = await supabase
      .from('taxonomy_level3')
      .update({
        label_de: label,
        sort_order: sortOrder,
        is_active: active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('taxonomy_level3')
    .insert({
      level2_id: level2Id,
      slug,
      label_de: label,
      sort_order: sortOrder,
      is_active: active,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function renameL3(level2Id, fromSlug, toSlug, toLabel, sortOrder) {
  const oldRow = await one('taxonomy_level3', (q) => q.eq('level2_id', level2Id).eq('slug', fromSlug));
  const newRow = await one('taxonomy_level3', (q) => q.eq('level2_id', level2Id).eq('slug', toSlug));

  if (oldRow && !newRow) {
    const { error } = await supabase
      .from('taxonomy_level3')
      .update({
        slug: toSlug,
        label_de: toLabel,
        sort_order: sortOrder,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', oldRow.id);
    if (error) throw error;
    return oldRow.id;
  }

  if (newRow) {
    const { error } = await supabase
      .from('taxonomy_level3')
      .update({
        label_de: toLabel,
        sort_order: sortOrder,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', newRow.id);
    if (error) throw error;
    if (oldRow && oldRow.id !== newRow.id) {
      await supabase
        .from('taxonomy_level3')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', oldRow.id);
    }
    return newRow.id;
  }

  return ensureL3(level2Id, toSlug, toLabel, sortOrder, true);
}

async function ensureL4(level3Id, slug, label, sortOrder, active = true) {
  const row = await one('taxonomy_level4', (q) => q.eq('level3_id', level3Id).eq('slug', slug));
  if (row) {
    const { error } = await supabase
      .from('taxonomy_level4')
      .update({
        label_de: label,
        sort_order: sortOrder,
        is_active: active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('taxonomy_level4')
    .insert({
      level3_id: level3Id,
      slug,
      label_de: label,
      sort_order: sortOrder,
      is_active: active,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function batchDeleteByIds(table, ids, chunkSize = 200) {
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).delete().in('id', chunk);
    if (error) throw error;
  }
}

async function batchUpdateIsActive(table, ids, active) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error } = await supabase
      .from(table)
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .in('id', chunk);
    if (error) throw error;
  }
}

function textMatch(course, pattern) {
  const txt = `${course?.title || ''} ${course?.description || ''}`;
  return pattern.test(txt);
}

async function remapByOldL4(oldId, classifier) {
  if (!oldId) return 0;
  const assignments = await fetchAll(
    'course_category_assignments',
    'id,course_id,level3_id,level4_id',
    (q) => q.eq('level4_id', oldId)
  );
  if (!assignments.length) return 0;
  const courseIds = [...new Set(assignments.map((a) => a.course_id))];
  const courses = await fetchAll('courses', 'id,title,description', (q) => q.in('id', courseIds));
  const cMap = new Map(courses.map((c) => [c.id, c]));

  let changed = 0;
  for (const a of assignments) {
    const target = classifier(cMap.get(a.course_id) || {});
    const { error } = await supabase
      .from('course_category_assignments')
      .update({ level3_id: target.level3, level4_id: target.level4 })
      .eq('id', a.id);
    if (error) throw error;
    changed += 1;
  }
  return changed;
}

async function main() {
  const l2Yoga = await one('taxonomy_level2', (q) => q.eq('slug', 'yoga_achtsamkeit'), 'id,slug');
  if (!l2Yoga) throw new Error('taxonomy_level2 slug=yoga_achtsamkeit not found');
  const level2Id = l2Yoga.id;

  const l3Yoga = await ensureL3(level2Id, 'yoga', 'Yoga', 1, true);
  const l3Meditation = await renameL3(
    level2Id,
    'mental_meditation',
    'meditation_achtsamkeit',
    'Meditation & Achtsamkeit',
    2
  );
  const l3Atem = await ensureL3(level2Id, 'atemarbeit', 'Atemarbeit', 3, true);
  const l3Klang = await ensureL3(level2Id, 'klang_mantra', 'Klang & Mantra', 4, true);
  const l3Somatics = await renameL3(
    level2Id,
    'koerperarbeit',
    'somatics_koerperbewusstsein',
    'Somatics & Körperbewusstsein',
    5
  );
  const l3Energie = await ensureL3(level2Id, 'energiearbeit', 'Energiearbeit', 6, true);
  const l3Bodywork = await ensureL3(level2Id, 'bodywork_massage', 'Bodywork & Massage', 7, true);
  const l3MentalHealth = await one(
    'taxonomy_level3',
    (q) => q.eq('level2_id', level2Id).eq('slug', 'mental_health'),
    'id'
  );

  const targets = {
    yoga: {
      id: l3Yoga,
      items: [
        ['hatha_grundlagen', 'Hatha & Grundlagen', 1],
        ['vinyasa_flow', 'Vinyasa & Flow', 2],
        ['yin_restorative', 'Yin & Restorative', 3],
        ['power_ashtanga', 'Power & Ashtanga', 4],
        ['kundalini', 'Kundalini', 5],
        ['alignment_iyengar_ausrichtung', 'Alignment (Iyengar & Ausrichtung)', 6],
        ['therapeutisches_yoga', 'Therapeutisches Yoga', 7],
        ['wasser_sup_yoga', 'Wasser-/SUP-Yoga', 8],
        ['hot_yoga', 'Hot Yoga', 9],
        ['aerial_acro_chair', 'Aerial / Acro / Chair', 10],
      ],
    },
    meditation: {
      id: l3Meditation,
      items: [
        ['achtsamkeitstraining_mbsr_alltag', 'Achtsamkeitstraining (MBSR/Alltag)', 1],
        ['gefuehrte_meditation', 'Geführte Meditation', 2],
        ['stille_meditation', 'Stille Meditation', 3],
        ['yoga_nidra', 'Yoga Nidra', 4],
        ['metta_selbstmitgefuehl', 'Metta / Selbstmitgefühl', 5],
      ],
    },
    atem: {
      id: l3Atem,
      items: [
        ['pranayama', 'Pranayama', 1],
        ['breathwork', 'Breathwork', 2],
        ['atemreise', 'Atemreise', 3],
      ],
    },
    klang: {
      id: l3Klang,
      items: [
        ['klangmeditation_sound_bath', 'Klangmeditation / Sound Bath', 1],
        ['gong_klanginstrumente', 'Gong & Klanginstrumente', 2],
        ['mantra_kirtan', 'Mantra & Kirtan', 3],
        ['klangreise', 'Klangreise', 4],
        ['rhythmus_trommeln', 'Rhythmus & Trommeln', 5],
      ],
    },
    somatics: {
      id: l3Somatics,
      items: [
        ['feldenkrais', 'Feldenkrais', 1],
        ['pilates_yoga_pilates', 'Pilates & Yoga-Pilates', 2],
        ['embodiment_somatic_movement', 'Embodiment / Somatic Movement', 3],
        ['faszien_mobility', 'Faszien & Mobility', 4],
        ['entspannungsverfahren_pmr_autogen', 'Entspannungsverfahren (PMR / Autogen)', 5],
      ],
    },
    energie: {
      id: l3Energie,
      items: [
        ['reiki', 'Reiki', 1],
        ['chakra_energiezentren', 'Chakra & Energiezentren', 2],
        ['energieheilung_healing', 'Energieheilung / Healing', 3],
      ],
    },
    bodywork: {
      id: l3Bodywork,
      items: [
        ['thai_yoga_massage', 'Thai Yoga Massage', 1],
        ['massage_wellness', 'Massage & Wellness', 2],
        ['koerpertherapie', 'Körpertherapie', 3],
      ],
    },
  };

  const l4 = {};
  for (const group of Object.values(targets)) {
    for (const [slug, label, sort] of group.items) {
      l4[slug] = await ensureL4(group.id, slug, label, sort, true);
    }
  }

  const oldIds = {
    hatha_flow_vinyasa: (await one('taxonomy_level4', (q) => q.eq('slug', 'hatha_flow_vinyasa'), 'id'))?.id || null,
    wasser_yoga: (await one('taxonomy_level4', (q) => q.eq('slug', 'wasser_yoga'), 'id'))?.id || null,
    yoga_nidra_old:
      (await one('taxonomy_level4', (q) => q.eq('slug', 'yoga_nidra').eq('level3_id', l3Yoga), 'id'))?.id ||
      null,
    meditation_achtsamkeit:
      (await one('taxonomy_level4', (q) => q.eq('slug', 'meditation_achtsamkeit'), 'id'))?.id || null,
    klang_atemreise: (await one('taxonomy_level4', (q) => q.eq('slug', 'klang_atemreise'), 'id'))?.id || null,
    reiki_chakra: (await one('taxonomy_level4', (q) => q.eq('slug', 'reiki_chakra'), 'id'))?.id || null,
    feldenkrais_pilates:
      (await one('taxonomy_level4', (q) => q.eq('slug', 'feldenkrais_pilates'), 'id'))?.id || null,
    massage_wellness_old:
      (await one('taxonomy_level4', (q) => q.eq('slug', 'massage_wellness').eq('level3_id', l3Somatics), 'id'))?.id ||
      null,
    resilienz_coaching:
      (await one('taxonomy_level4', (q) => q.eq('slug', 'resilienz_coaching'), 'id'))?.id || null,
  };

  let remapped = 0;
  remapped += await remapByOldL4(oldIds.hatha_flow_vinyasa, (c) => {
    const isHatha = textMatch(c, /(hatha|grundlage|grundkurs|einsteiger|anfaenger|anfanger|beginner)/i);
    return { level3: l3Yoga, level4: isHatha ? l4.hatha_grundlagen : l4.vinyasa_flow };
  });
  remapped += await remapByOldL4(oldIds.wasser_yoga, () => ({ level3: l3Yoga, level4: l4.wasser_sup_yoga }));
  remapped += await remapByOldL4(oldIds.yoga_nidra_old, () => ({ level3: l3Meditation, level4: l4.yoga_nidra }));
  remapped += await remapByOldL4(oldIds.meditation_achtsamkeit, (c) => {
    if (textMatch(c, /(stille|silent|vipassana|zen|zazen)/i)) return { level3: l3Meditation, level4: l4.stille_meditation };
    if (textMatch(c, /(metta|selbstmitgefuehl|compassion|loving\s*kindness)/i)) {
      return { level3: l3Meditation, level4: l4.metta_selbstmitgefuehl };
    }
    if (textMatch(c, /(mbsr|achtsamkeit|mindful|mindfulness|alltag)/i)) {
      return { level3: l3Meditation, level4: l4.achtsamkeitstraining_mbsr_alltag };
    }
    return { level3: l3Meditation, level4: l4.gefuehrte_meditation };
  });
  remapped += await remapByOldL4(oldIds.klang_atemreise, (c) => {
    if (textMatch(c, /(atem|breath|pranayama)/i)) return { level3: l3Atem, level4: l4.atemreise };
    return { level3: l3Klang, level4: l4.klangreise };
  });
  remapped += await remapByOldL4(oldIds.reiki_chakra, (c) => {
    if (textMatch(c, /(chakra|energiezentrum)/i)) return { level3: l3Energie, level4: l4.chakra_energiezentren };
    return { level3: l3Energie, level4: l4.reiki };
  });
  remapped += await remapByOldL4(oldIds.feldenkrais_pilates, (c) => {
    if (textMatch(c, /(pilates)/i)) return { level3: l3Somatics, level4: l4.pilates_yoga_pilates };
    return { level3: l3Somatics, level4: l4.feldenkrais };
  });
  remapped += await remapByOldL4(oldIds.massage_wellness_old, (c) => {
    if (textMatch(c, /(thai)/i)) return { level3: l3Bodywork, level4: l4.thai_yoga_massage };
    return { level3: l3Bodywork, level4: l4.massage_wellness };
  });
  remapped += await remapByOldL4(oldIds.resilienz_coaching, () => ({
    level3: l3Meditation,
    level4: l4.achtsamkeitstraining_mbsr_alltag,
  }));

  if (l3MentalHealth?.id) {
    const mentalAssignments = await fetchAll('course_category_assignments', 'id,level4_id', (q) =>
      q.eq('level3_id', l3MentalHealth.id)
    );
    for (const a of mentalAssignments) {
      const { error } = await supabase
        .from('course_category_assignments')
        .update({ level3_id: l3Meditation, level4_id: a.level4_id || l4.achtsamkeitstraining_mbsr_alltag })
        .eq('id', a.id);
      if (error) throw error;
      remapped += 1;
    }
  }

  const nullL4Assignments = await fetchAll('course_category_assignments', 'id,level3_id', (q) =>
    q.in('level3_id', [l3Yoga, l3Meditation, l3Atem, l3Klang, l3Somatics, l3Energie, l3Bodywork]).is('level4_id', null)
  );
  for (const a of nullL4Assignments) {
    const fallback = {
      [l3Yoga]: l4.vinyasa_flow,
      [l3Meditation]: l4.gefuehrte_meditation,
      [l3Atem]: l4.atemreise,
      [l3Klang]: l4.klangreise,
      [l3Somatics]: l4.feldenkrais,
      [l3Energie]: l4.reiki,
      [l3Bodywork]: l4.massage_wellness,
    }[a.level3_id];
    if (!fallback) continue;
    const { error } = await supabase.from('course_category_assignments').update({ level4_id: fallback }).eq('id', a.id);
    if (error) throw error;
  }

  const l3Personality = await one(
    'taxonomy_level3',
    (q) => q.eq('level2_id', level2Id).in('slug', ['persoenlichkeitsentwicklung', 'persoenlichkeit']),
    'id,slug'
  );
  const l3UnderYoga = await fetchAll('taxonomy_level3', 'id,slug', (q) => q.eq('level2_id', level2Id));
  const l3IdSet = new Set(l3UnderYoga.map((x) => x.id));
  const l4UnderYoga = await fetchAll('taxonomy_level4', 'id,slug,level3_id', (q) => q.in('level3_id', [...l3IdSet]));
  const l4Kausal = l4UnderYoga.find((x) => x.slug === 'kausaltraining') || null;

  if (l3Personality?.id) {
    const { error } = await supabase
      .from('course_category_assignments')
      .update({ level3_id: l3Meditation, level4_id: l4.achtsamkeitstraining_mbsr_alltag })
      .eq('level3_id', l3Personality.id);
    if (error) throw error;
  }
  if (l4Kausal?.id) {
    const { error } = await supabase
      .from('course_category_assignments')
      .update({ level3_id: l3Meditation, level4_id: l4.achtsamkeitstraining_mbsr_alltag })
      .eq('level4_id', l4Kausal.id);
    if (error) throw error;
  }

  const deactivateL3Slugs = ['mental_health', 'persoenlichkeitsentwicklung', 'persoenlichkeit', 'koerperarbeit', 'mental_meditation'];
  const l3ToDeactivate = l3UnderYoga.filter((r) => deactivateL3Slugs.includes(r.slug)).map((r) => r.id);
  if (l3ToDeactivate.length) await batchUpdateIsActive('taxonomy_level3', l3ToDeactivate, false);

  const legacyL4Slugs = new Set([
    'hatha_flow_vinyasa',
    'wasser_yoga',
    'meditation_achtsamkeit',
    'klang_atemreise',
    'reiki_chakra',
    'feldenkrais_pilates',
    'resilienz_coaching',
    'kausaltraining',
  ]);
  const l3ById = new Map(l3UnderYoga.map((r) => [r.id, r.slug]));
  const l4DeactivateIds = l4UnderYoga
    .filter(
      (r) =>
        legacyL4Slugs.has(r.slug) ||
        (r.slug === 'yoga_nidra' && l3ById.get(r.level3_id) === 'yoga') ||
        (r.slug === 'massage_wellness' &&
          ['koerperarbeit', 'somatics_koerperbewusstsein'].includes(l3ById.get(r.level3_id)))
    )
    .map((r) => r.id);
  if (l4DeactivateIds.length) await batchUpdateIsActive('taxonomy_level4', l4DeactivateIds, false);

  const assignmentsAll = await fetchAll(
    'course_category_assignments',
    'id,course_id,level3_id,level4_id,is_primary,created_at'
  );
  const dupMap = new Map();
  for (const a of assignmentsAll) {
    const k = `${a.course_id}|${a.level3_id}|${a.level4_id ?? 0}`;
    if (!dupMap.has(k)) dupMap.set(k, []);
    dupMap.get(k).push(a);
  }
  const dupDelete = [];
  for (const rows of dupMap.values()) {
    rows.sort(
      (a, b) =>
        Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
        String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
        a.id - b.id
    );
    for (let i = 1; i < rows.length; i += 1) dupDelete.push(rows[i].id);
  }
  if (dupDelete.length) await batchDeleteByIds('course_category_assignments', dupDelete);

  const afterDedupe = await fetchAll('course_category_assignments', 'id,course_id,is_primary,created_at');
  const byCourse = new Map();
  for (const a of afterDedupe) {
    if (!byCourse.has(a.course_id)) byCourse.set(a.course_id, []);
    byCourse.get(a.course_id).push(a);
  }
  let primaryFixes = 0;
  for (const rows of byCourse.values()) {
    rows.sort(
      (a, b) =>
        Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
        String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
        a.id - b.id
    );
    const keepId = rows[0].id;
    for (const r of rows) {
      const should = r.id === keepId;
      if (Boolean(r.is_primary) !== should) {
        const { error } = await supabase.from('course_category_assignments').update({ is_primary: should }).eq('id', r.id);
        if (error) throw error;
        primaryFixes += 1;
      }
    }
  }

  const primaries = await fetchAll('course_category_assignments', 'course_id,level3_id,level4_id', (q) =>
    q.eq('is_primary', true)
  );
  for (const p of primaries) {
    const { error } = await supabase
      .from('courses')
      .update({ category_level3_id: p.level3_id, category_level4_id: p.level4_id })
      .eq('id', p.course_id);
    if (error) throw error;
  }

  const { error: refreshErr } = await supabase.rpc('refresh_taxonomy_paths_manual');
  if (refreshErr) {
    console.warn('refresh_taxonomy_paths_manual failed:', refreshErr.message);
  }

  const verifyL3 = await fetchAll('taxonomy_level3', 'id,slug,label_de,sort_order,is_active', (q) =>
    q.eq('level2_id', level2Id).order('sort_order', { ascending: true })
  );
  const verifyAssign = await fetchAll('course_category_assignments', 'id,course_id,level3_id,level4_id,is_primary', (q) =>
    q.in('level3_id', verifyL3.map((x) => x.id))
  );
  const primByCourse = new Map();
  for (const a of verifyAssign) {
    if (!primByCourse.has(a.course_id)) primByCourse.set(a.course_id, 0);
    if (a.is_primary) primByCourse.set(a.course_id, primByCourse.get(a.course_id) + 1);
  }
  const invalidPrimaryCourses = [...primByCourse.values()].filter((n) => n !== 1).length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        level2: 'yoga_achtsamkeit',
        remappedAssignments: remapped,
        dedupeDeleted: dupDelete.length,
        primaryFixes,
        invalidPrimaryCourses,
        level3Nodes: verifyL3.map((x) => ({
          slug: x.slug,
          active: x.is_active,
          sort: x.sort_order,
        })),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
