import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSecret = process.env.ADMIN_CONSOLE_SECRET;

export default async function handler(req, res) {
    // Auth check
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    if (adminSecret) {
        const incoming = req.headers['x-admin-secret'];
        if (incoming !== adminSecret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { method } = req;

    // Detect which schema is available
    const schemaVersion = await detectSchema(supabaseAdmin);

    // ============================================
    // GET: Load entire taxonomy (Level 1-4)
    // ============================================
    if (method === 'GET') {
        try {
            if (schemaVersion === 'consolidated') {
                return await getConsolidatedTaxonomy(supabaseAdmin, res);
            } else if (schemaVersion === 'v2') {
                return await getV2Taxonomy(supabaseAdmin, res);
            } else {
                return await getLegacyTaxonomy(supabaseAdmin, res);
            }
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ============================================
    // POST: Create / Update / Delete operations
    // ============================================
    if (method === 'POST') {
        const { action, entity, data } = req.body;

        if (!action || !entity) {
            return res.status(400).json({ error: 'Missing action or entity' });
        }

        try {
            if (schemaVersion === 'consolidated') {
                return await handleConsolidatedMutation(supabaseAdmin, action, entity, data, res);
            } else if (schemaVersion === 'v2') {
                return await handleV2Mutation(supabaseAdmin, action, entity, data, res);
            } else {
                return await handleLegacyMutation(supabaseAdmin, action, entity, data, res);
            }
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// ============================================
// Schema Detection
// ============================================
async function detectSchema(supabase) {
    // Try consolidated schema first
    const { data: level1Data, error: level1Error } = await supabase
        .from('taxonomy_level1')
        .select('id')
        .limit(1);

    if (!level1Error && level1Data?.length > 0) {
        return 'consolidated';
    }

    // Try v2 schema
    const { data: v2Data, error: v2Error } = await supabase
        .from('taxonomy_types_v2')
        .select('id')
        .limit(1);

    if (!v2Error && v2Data?.length > 0) {
        return 'v2';
    }

    return 'legacy';
}

// ============================================
// Consolidated Schema (taxonomy_level1/2/3/4)
// ============================================
async function getConsolidatedTaxonomy(supabase, res) {
    const [level1Res, level2Res, level3Res, level4Res] = await Promise.all([
        supabase.from('taxonomy_level1').select('*').order('sort_order'),
        supabase.from('taxonomy_level2').select('*').order('sort_order'),
        supabase.from('taxonomy_level3').select('*').order('sort_order'),
        supabase.from('taxonomy_level4').select('*').order('sort_order')
    ]);

    if (level1Res.error) throw level1Res.error;
    if (level2Res.error) throw level2Res.error;
    if (level3Res.error) throw level3Res.error;

    // Map to legacy format for backward compatibility
    const types = (level1Res.data || []).map(t => ({
        id: t.slug || t.id, // Use slug as ID for legacy compat
        numericId: t.id,
        slug: t.slug,
        label_de: t.label_de,
        label_en: t.label_en,
        label_fr: t.label_fr,
        label_it: t.label_it,
        icon: t.icon,
        sort_order: t.sort_order,
        is_active: t.is_active
    }));

    const areas = (level2Res.data || []).map(a => {
        const parent = level1Res.data.find(t => t.id === a.level1_id);
        return {
            id: a.slug || a.id,
            numericId: a.id,
            slug: a.slug,
            type_id: parent?.slug || a.level1_id,
            level1_id: a.level1_id,
            label_de: a.label_de,
            label_en: a.label_en,
            label_fr: a.label_fr,
            label_it: a.label_it,
            icon: a.icon,
            sort_order: a.sort_order,
            is_active: a.is_active
        };
    });

    const specialties = (level3Res.data || []).map(s => {
        const parent = level2Res.data.find(a => a.id === s.level2_id);
        return {
            id: s.id,
            numericId: s.id,
            slug: s.slug,
            area_id: parent?.slug || s.level2_id,
            level2_id: s.level2_id,
            name: s.label_de,
            label_de: s.label_de,
            label_en: s.label_en,
            label_fr: s.label_fr,
            label_it: s.label_it,
            sort_order: s.sort_order,
            is_active: s.is_active
        };
    });

    const focuses = (level4Res.data || []).map(f => ({
        id: f.id,
        numericId: f.id,
        slug: f.slug,
        specialty_id: f.level3_id,
        level3_id: f.level3_id,
        name: f.label_de,
        label_de: f.label_de,
        label_en: f.label_en,
        label_fr: f.label_fr,
        label_it: f.label_it,
        sort_order: f.sort_order,
        is_active: f.is_active
    }));

    // Fetch course counts using new junction table
    const courseCounts = await getConsolidatedCourseCounts(supabase, level1Res.data, level2Res.data, level3Res.data, level4Res.data);

    return res.status(200).json({
        types,
        areas,
        specialties,
        focuses,
        courseCounts,
        schemaVersion: 'consolidated'
    });
}

async function getConsolidatedCourseCounts(supabase, level1Data, level2Data, level3Data, level4Data) {
    const courseCounts = { types: {}, areas: {}, specialties: {}, focuses: {} };

    // Get assignments only for published courses
    const { data: assignments } = await supabase
        .from('course_category_assignments')
        .select('level3_id, level4_id, courses!inner(status)')
        .eq('courses.status', 'published');

    if (!assignments) return courseCounts;

    // Build lookup maps
    const level3ToLevel2 = {};
    const level2ToLevel1 = {};

    level3Data?.forEach(s => {
        level3ToLevel2[s.id] = s.level2_id;
    });

    level2Data?.forEach(a => {
        level2ToLevel1[a.id] = a.level1_id;
    });

    // Count per level3 (specialty)
    const level3Counts = {};
    const level4Counts = {};

    assignments.forEach(a => {
        // Count level3
        level3Counts[a.level3_id] = (level3Counts[a.level3_id] || 0) + 1;

        // Count level4 if present
        if (a.level4_id) {
            level4Counts[a.level4_id] = (level4Counts[a.level4_id] || 0) + 1;
        }
    });

    // Aggregate up to level2 and level1
    const level2Counts = {};
    const level1Counts = {};

    Object.entries(level3Counts).forEach(([level3Id, count]) => {
        const level2Id = level3ToLevel2[level3Id];
        if (level2Id) {
            level2Counts[level2Id] = (level2Counts[level2Id] || 0) + count;
            const level1Id = level2ToLevel1[level2Id];
            if (level1Id) {
                level1Counts[level1Id] = (level1Counts[level1Id] || 0) + count;
            }
        }
    });

    // Map to slug-based keys for legacy compatibility
    level1Data?.forEach(t => {
        const key = t.slug || t.id;
        courseCounts.types[key] = level1Counts[t.id] || 0;
    });

    level2Data?.forEach(a => {
        const key = a.slug || a.id;
        courseCounts.areas[key] = level2Counts[a.id] || 0;
    });

    level3Data?.forEach(s => {
        courseCounts.specialties[s.label_de] = level3Counts[s.id] || 0;
    });

    level4Data?.forEach(f => {
        courseCounts.focuses[f.label_de] = level4Counts[f.id] || 0;
    });

    return courseCounts;
}

async function handleConsolidatedMutation(supabase, action, entity, data, res) {
    // Map entity names to table names
    const tableMap = {
        'type': 'taxonomy_level1',
        'level1': 'taxonomy_level1',
        'area': 'taxonomy_level2',
        'level2': 'taxonomy_level2',
        'specialty': 'taxonomy_level3',
        'level3': 'taxonomy_level3',
        'focus': 'taxonomy_level4',
        'level4': 'taxonomy_level4'
    };

    const tableName = tableMap[entity];
    if (!tableName) {
        return res.status(400).json({ error: `Unknown entity: ${entity}` });
    }

    // --- CREATE ---
    if (action === 'create') {
        const insertData = buildInsertData(entity, data);

        // Resolve slug strings to numeric IDs for foreign key columns
        if ((entity === 'area' || entity === 'level2') && insertData.level1_id && isNaN(Number(insertData.level1_id))) {
            const { data: parentData } = await supabase
                .from('taxonomy_level1')
                .select('id')
                .eq('slug', insertData.level1_id)
                .single();
            if (parentData) insertData.level1_id = parentData.id;
        }
        if ((entity === 'specialty' || entity === 'level3') && insertData.level2_id && isNaN(Number(insertData.level2_id))) {
            const { data: parentData } = await supabase
                .from('taxonomy_level2')
                .select('id')
                .eq('slug', insertData.level2_id)
                .single();
            if (parentData) insertData.level2_id = parentData.id;
        }
        if ((entity === 'focus' || entity === 'level4') && insertData.level3_id && isNaN(Number(insertData.level3_id))) {
            const { data: parentData } = await supabase
                .from('taxonomy_level3')
                .select('id')
                .eq('slug', insertData.level3_id)
                .single();
            if (parentData) insertData.level3_id = parentData.id;
        }

        const { error } = await supabase.from(tableName).insert(insertData);
        if (error) throw error;

        // Refresh materialized view
        await refreshTaxonomyView(supabase);

        return res.status(200).json({ success: true });
    }

    // --- UPDATE ---
    if (action === 'update') {
        const { id, numericId, ...updates } = data;
        const targetId = numericId || id;

        if (!targetId) {
            return res.status(400).json({ error: 'id required' });
        }

        // Map field names for consolidated schema
        const mappedUpdates = {};
        if (updates.label_de !== undefined) mappedUpdates.label_de = updates.label_de;
        if (updates.label_en !== undefined) mappedUpdates.label_en = updates.label_en;
        if (updates.label_fr !== undefined) mappedUpdates.label_fr = updates.label_fr;
        if (updates.label_it !== undefined) mappedUpdates.label_it = updates.label_it;
        if (updates.sort_order !== undefined) mappedUpdates.sort_order = updates.sort_order;
        if (updates.slug !== undefined) mappedUpdates.slug = updates.slug;
        if (updates.icon !== undefined) mappedUpdates.icon = updates.icon;
        if (updates.is_active !== undefined) mappedUpdates.is_active = updates.is_active;
        // Legacy 'name' field maps to label_de
        if (updates.name !== undefined) mappedUpdates.label_de = updates.name;

        mappedUpdates.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from(tableName)
            .update(mappedUpdates)
            .eq('id', targetId);
        if (error) throw error;

        // Refresh materialized view
        await refreshTaxonomyView(supabase);

        return res.status(200).json({ success: true });
    }

    // --- DELETE ---
    if (action === 'delete') {
        const { id, numericId, reassign_to } = data;
        const targetId = numericId || id;

        if (!targetId) {
            return res.status(400).json({ error: 'id required' });
        }

        // Handle reassignment if needed
        if (reassign_to && (entity === 'specialty' || entity === 'level3')) {
            // Reassign courses to new specialty
            await supabase
                .from('course_category_assignments')
                .update({ level3_id: reassign_to })
                .eq('level3_id', targetId);

            await supabase
                .from('courses')
                .update({ category_level3_id: reassign_to })
                .eq('category_level3_id', targetId);
        }

        if (reassign_to && (entity === 'focus' || entity === 'level4')) {
            // Reassign courses to new focus
            await supabase
                .from('course_category_assignments')
                .update({ level4_id: reassign_to })
                .eq('level4_id', targetId);

            await supabase
                .from('courses')
                .update({ category_level4_id: reassign_to })
                .eq('category_level4_id', targetId);
        }

        // Delete the entity (CASCADE will handle children)
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', targetId);
        if (error) throw error;

        // Refresh materialized view
        await refreshTaxonomyView(supabase);

        return res.status(200).json({ success: true });
    }

    // --- COUNT COURSES ---
    if (action === 'count_courses') {
        const { id, numericId } = data;
        const targetId = numericId || id;
        let count = 0;

        if (entity === 'specialty' || entity === 'level3') {
            const { count: c } = await supabase
                .from('course_category_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('level3_id', targetId);
            count = c || 0;
        } else if (entity === 'focus' || entity === 'level4') {
            const { count: c } = await supabase
                .from('course_category_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('level4_id', targetId);
            count = c || 0;
        } else if (entity === 'area' || entity === 'level2') {
            // Get all level3 IDs under this level2
            const { data: level3s } = await supabase
                .from('taxonomy_level3')
                .select('id')
                .eq('level2_id', targetId);

            if (level3s?.length > 0) {
                const level3Ids = level3s.map(s => s.id);
                const { count: c } = await supabase
                    .from('course_category_assignments')
                    .select('*', { count: 'exact', head: true })
                    .in('level3_id', level3Ids);
                count = c || 0;
            }
        } else if (entity === 'type' || entity === 'level1') {
            // Get all level2 -> level3 IDs under this level1
            const { data: level2s } = await supabase
                .from('taxonomy_level2')
                .select('id')
                .eq('level1_id', targetId);

            if (level2s?.length > 0) {
                const level2Ids = level2s.map(a => a.id);
                const { data: level3s } = await supabase
                    .from('taxonomy_level3')
                    .select('id')
                    .in('level2_id', level2Ids);

                if (level3s?.length > 0) {
                    const level3Ids = level3s.map(s => s.id);
                    const { count: c } = await supabase
                        .from('course_category_assignments')
                        .select('*', { count: 'exact', head: true })
                        .in('level3_id', level3Ids);
                    count = c || 0;
                }
            }
        }

        return res.status(200).json({ count });
    }

    return res.status(400).json({ error: 'Invalid action' });
}

function buildInsertData(entity, data) {
    if (entity === 'type' || entity === 'level1') {
        return {
            slug: data.id || data.slug,
            label_de: data.label_de,
            label_en: data.label_en,
            label_fr: data.label_fr,
            label_it: data.label_it,
            icon: data.icon,
            sort_order: data.sort_order || 0,
            is_active: data.is_active !== false
        };
    }

    if (entity === 'area' || entity === 'level2') {
        return {
            level1_id: data.level1_id || data.type_id,
            slug: data.id || data.slug,
            label_de: data.label_de,
            label_en: data.label_en,
            label_fr: data.label_fr,
            label_it: data.label_it,
            icon: data.icon,
            sort_order: data.sort_order || 0,
            is_active: data.is_active !== false
        };
    }

    if (entity === 'specialty' || entity === 'level3') {
        return {
            level2_id: data.level2_id || data.area_id,
            slug: data.slug,
            label_de: data.name || data.label_de,
            label_en: data.label_en,
            label_fr: data.label_fr,
            label_it: data.label_it,
            sort_order: data.sort_order || 0,
            is_active: data.is_active !== false
        };
    }

    if (entity === 'focus' || entity === 'level4') {
        return {
            level3_id: data.level3_id || data.specialty_id,
            slug: data.slug,
            label_de: data.name || data.label_de,
            label_en: data.label_en,
            label_fr: data.label_fr,
            label_it: data.label_it,
            sort_order: data.sort_order || 0,
            is_active: data.is_active !== false
        };
    }

    return data;
}

async function refreshTaxonomyView(supabase) {
    try {
        // Use the manually callable version (refresh_taxonomy_paths is RETURNS TRIGGER
        // and can't be called via RPC)
        await supabase.rpc('refresh_taxonomy_paths_manual');
    } catch (e) {
        // View refresh is non-critical, log but don't fail
        console.warn('Failed to refresh taxonomy view:', e.message);
    }
}

// ============================================
// V2 Schema (taxonomy_types_v2 etc.) - Legacy support
// ============================================
async function getV2Taxonomy(supabase, res) {
    const [typesRes, areasRes, specialtiesRes, focusesRes] = await Promise.all([
        supabase.from('taxonomy_types_v2').select('*').order('sort_order'),
        supabase.from('taxonomy_areas_v2').select('*').order('sort_order'),
        supabase.from('taxonomy_specialties_v2').select('*').order('sort_order'),
        supabase.from('taxonomy_focus_v2').select('*').order('sort_order')
    ]);

    if (typesRes.error) throw typesRes.error;
    if (areasRes.error) throw areasRes.error;
    if (specialtiesRes.error) throw specialtiesRes.error;

    // Map to expected format
    const types = (typesRes.data || []).map(t => ({
        id: t.slug || t.id,
        numericId: t.id,
        slug: t.slug,
        label_de: t.label_de,
        label_en: t.label_en,
        label_fr: t.label_fr,
        label_it: t.label_it,
        icon: t.icon,
        sort_order: t.sort_order
    }));

    const areas = (areasRes.data || []).map(a => {
        const parent = typesRes.data.find(t => t.id === a.type_id);
        return {
            id: a.slug || a.id,
            numericId: a.id,
            slug: a.slug,
            type_id: parent?.slug || a.type_id,
            label_de: a.label_de,
            label_en: a.label_en,
            label_fr: a.label_fr,
            label_it: a.label_it,
            sort_order: a.sort_order
        };
    });

    const specialties = (specialtiesRes.data || []).map(s => {
        const parent = areasRes.data.find(a => a.id === s.area_id);
        return {
            id: s.id,
            numericId: s.id,
            area_id: parent?.slug || s.area_id,
            name: s.label_de,
            label_de: s.label_de,
            sort_order: s.sort_order
        };
    });

    const focuses = (focusesRes.data || []).map(f => ({
        id: f.id,
        numericId: f.id,
        specialty_id: f.specialty_id,
        name: f.label_de,
        label_de: f.label_de,
        sort_order: f.sort_order
    }));

    // Course counts from old junction table
    const courseCounts = await getLegacyCourseCounts(supabase);

    return res.status(200).json({
        types,
        areas,
        specialties,
        focuses,
        courseCounts,
        schemaVersion: 'v2'
    });
}

async function handleV2Mutation(supabase, action, entity, data, res) {
    // For V2, forward to legacy handler (same table structure)
    return handleLegacyMutation(supabase, action, entity, data, res, true);
}

// ============================================
// Legacy Schema (taxonomy_types etc.)
// ============================================
async function getLegacyTaxonomy(supabase, res) {
    const [typesRes, areasRes, specialtiesRes, focusesRes] = await Promise.all([
        supabase.from('taxonomy_types').select('*').order('sort_order'),
        supabase.from('taxonomy_areas').select('*').order('sort_order'),
        supabase.from('taxonomy_specialties').select('*').order('sort_order'),
        supabase.from('taxonomy_focus').select('*').order('sort_order')
    ]);

    if (typesRes.error) throw typesRes.error;
    if (areasRes.error) throw areasRes.error;
    if (specialtiesRes.error) throw specialtiesRes.error;

    const courseCounts = await getLegacyCourseCounts(supabase);

    return res.status(200).json({
        types: typesRes.data || [],
        areas: areasRes.data || [],
        specialties: specialtiesRes.data || [],
        focuses: focusesRes.error ? [] : (focusesRes.data || []),
        courseCounts,
        schemaVersion: 'legacy'
    });
}

async function getLegacyCourseCounts(supabase) {
    const courseCounts = { types: {}, areas: {}, specialties: {}, focuses: {} };

    // Use v_course_full_categories view to get course counts by taxonomy level
    const { data: categoriesData } = await supabase
        .from('v_course_full_categories')
        .select('level1_slug, level2_slug, level3_slug, level4_slug');

    categoriesData?.forEach(row => {
        if (row.level1_slug) {
            courseCounts.types[row.level1_slug] = (courseCounts.types[row.level1_slug] || 0) + 1;
        }
        if (row.level2_slug) {
            courseCounts.areas[row.level2_slug] = (courseCounts.areas[row.level2_slug] || 0) + 1;
        }
        if (row.level3_slug) {
            courseCounts.specialties[row.level3_slug] = (courseCounts.specialties[row.level3_slug] || 0) + 1;
        }
        if (row.level4_slug) {
            courseCounts.focuses[row.level4_slug] = (courseCounts.focuses[row.level4_slug] || 0) + 1;
        }
    });

    return courseCounts;
}

async function handleLegacyMutation(supabase, action, entity, data, res, isV2 = false) {
    const tablePrefix = isV2 ? '_v2' : '';

    // --- CREATE ---
    if (action === 'create') {
        if (entity === 'type') {
            const { id, label_de, label_en, label_fr, label_it, sort_order } = data;
            if (!id || !label_de) {
                return res.status(400).json({ error: 'id and label_de required' });
            }
            const tableName = isV2 ? 'taxonomy_types_v2' : 'taxonomy_types';
            const insertData = isV2
                ? { slug: id, label_de, label_en, label_fr, label_it, sort_order: sort_order || 0 }
                : { id, label_de, label_en, label_fr, label_it, sort_order: sort_order || 0 };
            const { error } = await supabase.from(tableName).insert(insertData);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'area') {
            const { id, type_id, label_de, label_en, label_fr, label_it, sort_order } = data;
            if (!id || !type_id || !label_de) {
                return res.status(400).json({ error: 'id, type_id and label_de required' });
            }
            const tableName = isV2 ? 'taxonomy_areas_v2' : 'taxonomy_areas';

            let parentId = type_id;
            if (isV2) {
                // Need to look up numeric type_id from slug
                const { data: typeData } = await supabase
                    .from('taxonomy_types_v2')
                    .select('id')
                    .eq('slug', type_id)
                    .single();
                parentId = typeData?.id || type_id;
            }

            const insertData = isV2
                ? { type_id: parentId, slug: id, label_de, label_en, label_fr, label_it, sort_order: sort_order || 0 }
                : { id, type_id, label_de, label_en, label_fr, label_it, sort_order: sort_order || 0 };
            const { error } = await supabase.from(tableName).insert(insertData);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'specialty') {
            const { area_id, name, sort_order } = data;
            if (!area_id || !name) {
                return res.status(400).json({ error: 'area_id and name required' });
            }
            const tableName = isV2 ? 'taxonomy_specialties_v2' : 'taxonomy_specialties';

            let parentId = area_id;
            if (isV2) {
                const { data: areaData } = await supabase
                    .from('taxonomy_areas_v2')
                    .select('id')
                    .eq('slug', area_id)
                    .single();
                parentId = areaData?.id || area_id;
            }

            const insertData = isV2
                ? { area_id: parentId, label_de: name, sort_order: sort_order || 0 }
                : { area_id, name, sort_order: sort_order || 0 };
            const { error } = await supabase.from(tableName).insert(insertData);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'focus') {
            const { specialty_id, name, sort_order } = data;
            if (!specialty_id || !name) {
                return res.status(400).json({ error: 'specialty_id and name required' });
            }
            const tableName = isV2 ? 'taxonomy_focus_v2' : 'taxonomy_focus';
            const insertData = isV2
                ? { specialty_id, label_de: name, sort_order: sort_order || 0 }
                : { specialty_id, name, sort_order: sort_order || 0 };
            const { error } = await supabase.from(tableName).insert(insertData);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }
    }

    // --- UPDATE ---
    if (action === 'update') {
        if (entity === 'type') {
            const { id, label_de, label_en, label_fr, label_it, sort_order } = data;
            if (!id) return res.status(400).json({ error: 'id required' });
            const updates = {};
            if (label_de !== undefined) updates.label_de = label_de;
            if (label_en !== undefined) updates.label_en = label_en;
            if (label_fr !== undefined) updates.label_fr = label_fr;
            if (label_it !== undefined) updates.label_it = label_it;
            if (sort_order !== undefined) updates.sort_order = sort_order;

            const tableName = isV2 ? 'taxonomy_types_v2' : 'taxonomy_types';
            const idField = isV2 ? 'slug' : 'id';
            const { error } = await supabase.from(tableName).update(updates).eq(idField, id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'area') {
            const { id, label_de, label_en, label_fr, label_it, sort_order } = data;
            if (!id) return res.status(400).json({ error: 'id required' });
            const updates = {};
            if (label_de !== undefined) updates.label_de = label_de;
            if (label_en !== undefined) updates.label_en = label_en;
            if (label_fr !== undefined) updates.label_fr = label_fr;
            if (label_it !== undefined) updates.label_it = label_it;
            if (sort_order !== undefined) updates.sort_order = sort_order;

            const tableName = isV2 ? 'taxonomy_areas_v2' : 'taxonomy_areas';
            const idField = isV2 ? 'slug' : 'id';
            const { error } = await supabase.from(tableName).update(updates).eq(idField, id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'specialty') {
            const { id, name, sort_order } = data;
            if (!id) return res.status(400).json({ error: 'id required' });
            const updates = {};
            if (name !== undefined) {
                if (isV2) {
                    updates.label_de = name;
                } else {
                    updates.name = name;
                }
            }
            if (sort_order !== undefined) updates.sort_order = sort_order;

            const tableName = isV2 ? 'taxonomy_specialties_v2' : 'taxonomy_specialties';
            const { error } = await supabase.from(tableName).update(updates).eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'focus') {
            const { id, name, sort_order } = data;
            if (!id) return res.status(400).json({ error: 'id required' });
            const updates = {};
            if (name !== undefined) {
                if (isV2) {
                    updates.label_de = name;
                } else {
                    updates.name = name;
                }
            }
            if (sort_order !== undefined) updates.sort_order = sort_order;

            const tableName = isV2 ? 'taxonomy_focus_v2' : 'taxonomy_focus';
            const { error } = await supabase.from(tableName).update(updates).eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }
    }

    // --- DELETE ---
    if (action === 'delete') {
        const { id, reassign_to } = data;
        if (!id) return res.status(400).json({ error: 'id required' });

        // Handle reassignment and deletion for each entity type
        // (Same logic as before, but with v2 table names when needed)
        if (entity === 'focus') {
            const tableName = isV2 ? 'taxonomy_focus_v2' : 'taxonomy_focus';
            const nameField = isV2 ? 'label_de' : 'name';

            const { data: focusData, error: fetchErr } = await supabase
                .from(tableName)
                .select(`${nameField}, specialty_id`)
                .eq('id', id)
                .single();
            if (fetchErr) throw fetchErr;

            const oldName = focusData[nameField];

            if (reassign_to) {
                const { data: newFocus } = await supabase
                    .from(tableName)
                    .select(nameField)
                    .eq('id', reassign_to)
                    .single();

                if (newFocus) {
                    await supabase
                        .from('courses')
                        .update({ category_focus: newFocus[nameField] })
                        .eq('category_focus', oldName);
                }
            } else {
                await supabase
                    .from('courses')
                    .update({ category_focus: null })
                    .eq('category_focus', oldName);
            }

            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'specialty') {
            const tableName = isV2 ? 'taxonomy_specialties_v2' : 'taxonomy_specialties';
            const nameField = isV2 ? 'label_de' : 'name';

            const { data: specData, error: fetchErr } = await supabase
                .from(tableName)
                .select(`${nameField}, area_id`)
                .eq('id', id)
                .single();
            if (fetchErr) throw fetchErr;

            const oldName = specData[nameField];

            if (reassign_to) {
                const { data: newSpec } = await supabase
                    .from(tableName)
                    .select(nameField)
                    .eq('id', reassign_to)
                    .single();

                if (newSpec) {
                    await supabase
                        .from('courses')
                        .update({ category_specialty: newSpec[nameField] })
                        .eq('category_specialty', oldName);
                }
            }

            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'area') {
            const tableName = isV2 ? 'taxonomy_areas_v2' : 'taxonomy_areas';
            const idField = isV2 ? 'slug' : 'id';

            if (reassign_to) {
                await supabase
                    .from('courses')
                    .update({ category_area: reassign_to })
                    .eq('category_area', id);
            }

            const { error } = await supabase.from(tableName).delete().eq(idField, id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (entity === 'type') {
            const tableName = isV2 ? 'taxonomy_types_v2' : 'taxonomy_types';
            const idField = isV2 ? 'slug' : 'id';

            if (reassign_to) {
                await supabase
                    .from('courses')
                    .update({ category_type: reassign_to })
                    .eq('category_type', id);
            }

            const { error } = await supabase.from(tableName).delete().eq(idField, id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }
    }

    // --- COUNT COURSES ---
    if (action === 'count_courses') {
        let count = 0;

        if (entity === 'focus') {
            // Get level4_id from taxonomy_level4
            const { data: focusItem } = await supabase
                .from('taxonomy_level4')
                .select('id')
                .eq('id', data.id)
                .single();

            if (focusItem) {
                const { count: c } = await supabase
                    .from('course_category_assignments')
                    .select('*', { count: 'exact', head: true })
                    .eq('level4_id', focusItem.id);
                count = c || 0;
            }
        }

        if (entity === 'specialty') {
            // Get level3_id from taxonomy_level3
            const { data: spec } = await supabase
                .from('taxonomy_level3')
                .select('id')
                .eq('id', data.id)
                .single();

            if (spec) {
                const { count: c } = await supabase
                    .from('course_category_assignments')
                    .select('*', { count: 'exact', head: true })
                    .eq('level3_id', spec.id);
                count = c || 0;
            }
        }

        if (entity === 'area') {
            // Count courses via level3 assignments that belong to this area
            const { data: specs } = await supabase
                .from('taxonomy_level3')
                .select('id')
                .eq('level2_id', data.id);

            if (specs && specs.length > 0) {
                const specIds = specs.map(s => s.id);
                const { count: c } = await supabase
                    .from('course_category_assignments')
                    .select('*', { count: 'exact', head: true })
                    .in('level3_id', specIds);
                count = c || 0;
            }
        }

        if (entity === 'type') {
            // Count courses via level3 assignments that belong to this type
            const { data: areas } = await supabase
                .from('taxonomy_level2')
                .select('id')
                .eq('level1_id', data.id);

            if (areas && areas.length > 0) {
                const areaIds = areas.map(a => a.id);
                const { data: specs } = await supabase
                    .from('taxonomy_level3')
                    .select('id')
                    .in('level2_id', areaIds);

                if (specs && specs.length > 0) {
                    const specIds = specs.map(s => s.id);
                    const { count: c } = await supabase
                        .from('course_category_assignments')
                        .select('*', { count: 'exact', head: true })
                        .in('level3_id', specIds);
                    count = c || 0;
                }
            }
        }

        return res.status(200).json({ count });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
