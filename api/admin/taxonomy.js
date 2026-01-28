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

    // ============================================
    // GET: Load entire taxonomy (including Level 4: focuses)
    // ============================================
    if (method === 'GET') {
        try {
            const [typesRes, areasRes, specialtiesRes, focusesRes] = await Promise.all([
                supabaseAdmin.from('taxonomy_types').select('*').order('sort_order'),
                supabaseAdmin.from('taxonomy_areas').select('*').order('sort_order'),
                supabaseAdmin.from('taxonomy_specialties').select('*').order('sort_order'),
                supabaseAdmin.from('taxonomy_focus').select('*').order('sort_order')
            ]);

            if (typesRes.error) throw typesRes.error;
            if (areasRes.error) throw areasRes.error;
            if (specialtiesRes.error) throw specialtiesRes.error;
            // focuses table may not exist yet — graceful fallback
            const focuses = focusesRes.error ? [] : (focusesRes.data || []);

            return res.status(200).json({
                types: typesRes.data || [],
                areas: areasRes.data || [],
                specialties: specialtiesRes.data || [],
                focuses
            });
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
            // --- CREATE ---
            if (action === 'create') {
                if (entity === 'type') {
                    const { id, label_de, label_en, label_fr, label_it, sort_order } = data;
                    if (!id || !label_de) {
                        return res.status(400).json({ error: 'id and label_de required' });
                    }
                    const { error } = await supabaseAdmin
                        .from('taxonomy_types')
                        .insert({ id, label_de, label_en, label_fr, label_it, sort_order: sort_order || 0 });
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'area') {
                    const { id, type_id, label_de, label_en, label_fr, label_it, sort_order } = data;
                    if (!id || !type_id || !label_de) {
                        return res.status(400).json({ error: 'id, type_id and label_de required' });
                    }
                    const { error } = await supabaseAdmin
                        .from('taxonomy_areas')
                        .insert({ id, type_id, label_de, label_en, label_fr, label_it, sort_order: sort_order || 0 });
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'specialty') {
                    const { area_id, name, sort_order } = data;
                    if (!area_id || !name) {
                        return res.status(400).json({ error: 'area_id and name required' });
                    }
                    const { error } = await supabaseAdmin
                        .from('taxonomy_specialties')
                        .insert({ area_id, name, sort_order: sort_order || 0 });
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'focus') {
                    const { specialty_id, name, sort_order } = data;
                    if (!specialty_id || !name) {
                        return res.status(400).json({ error: 'specialty_id and name required' });
                    }
                    const { error } = await supabaseAdmin
                        .from('taxonomy_focus')
                        .insert({ specialty_id, name, sort_order: sort_order || 0 });
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
                    const { error } = await supabaseAdmin
                        .from('taxonomy_types')
                        .update(updates)
                        .eq('id', id);
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
                    const { error } = await supabaseAdmin
                        .from('taxonomy_areas')
                        .update(updates)
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'specialty') {
                    const { id, name, sort_order } = data;
                    if (!id) return res.status(400).json({ error: 'id required' });
                    const updates = {};
                    if (name !== undefined) updates.name = name;
                    if (sort_order !== undefined) updates.sort_order = sort_order;
                    const { error } = await supabaseAdmin
                        .from('taxonomy_specialties')
                        .update(updates)
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'focus') {
                    const { id, name, sort_order } = data;
                    if (!id) return res.status(400).json({ error: 'id required' });
                    const updates = {};
                    if (name !== undefined) updates.name = name;
                    if (sort_order !== undefined) updates.sort_order = sort_order;
                    const { error } = await supabaseAdmin
                        .from('taxonomy_focus')
                        .update(updates)
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
            }

            // --- DELETE with REASSIGN ---
            if (action === 'delete') {
                const { id, reassign_to } = data;
                if (!id) return res.status(400).json({ error: 'id required' });

                if (entity === 'focus') {
                    // Get the focus name first
                    const { data: focusData, error: fetchErr } = await supabaseAdmin
                        .from('taxonomy_focus')
                        .select('name, specialty_id')
                        .eq('id', id)
                        .single();
                    if (fetchErr) throw fetchErr;

                    const oldName = focusData.name;

                    // If reassign_to is provided, update courses first
                    if (reassign_to) {
                        const { data: newFocus } = await supabaseAdmin
                            .from('taxonomy_focus')
                            .select('name')
                            .eq('id', reassign_to)
                            .single();

                        if (newFocus) {
                            // Update course_categories junction table
                            await supabaseAdmin
                                .from('course_categories')
                                .update({ category_focus: newFocus.name })
                                .eq('category_focus', oldName);

                            // Update courses table
                            await supabaseAdmin
                                .from('courses')
                                .update({ category_focus: newFocus.name })
                                .eq('category_focus', oldName);
                        }
                    } else {
                        // No reassign — clear focus from courses
                        await supabaseAdmin
                            .from('course_categories')
                            .update({ category_focus: null })
                            .eq('category_focus', oldName);

                        await supabaseAdmin
                            .from('courses')
                            .update({ category_focus: null })
                            .eq('category_focus', oldName);
                    }

                    // Delete the focus
                    const { error } = await supabaseAdmin
                        .from('taxonomy_focus')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'specialty') {
                    // Get the specialty name first
                    const { data: specData, error: fetchErr } = await supabaseAdmin
                        .from('taxonomy_specialties')
                        .select('name, area_id')
                        .eq('id', id)
                        .single();
                    if (fetchErr) throw fetchErr;

                    const oldName = specData.name;

                    // If reassign_to is provided, update courses first
                    if (reassign_to) {
                        // Get new specialty name
                        const { data: newSpec } = await supabaseAdmin
                            .from('taxonomy_specialties')
                            .select('name')
                            .eq('id', reassign_to)
                            .single();

                        if (newSpec) {
                            // Update course_categories junction table
                            await supabaseAdmin
                                .from('course_categories')
                                .update({ category_specialty: newSpec.name })
                                .eq('category_specialty', oldName);

                            // Update courses table
                            await supabaseAdmin
                                .from('courses')
                                .update({ category_specialty: newSpec.name })
                                .eq('category_specialty', oldName);
                        }
                    }

                    // Delete the specialty (cascades to focuses)
                    const { error } = await supabaseAdmin
                        .from('taxonomy_specialties')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'area') {
                    // Get area info
                    const { data: areaData, error: fetchErr } = await supabaseAdmin
                        .from('taxonomy_areas')
                        .select('id')
                        .eq('id', id)
                        .single();
                    if (fetchErr) throw fetchErr;

                    // If reassign_to provided, move courses to new area
                    if (reassign_to) {
                        // Get new area id
                        const newAreaId = reassign_to;

                        // Update course_categories
                        await supabaseAdmin
                            .from('course_categories')
                            .update({ category_area: newAreaId })
                            .eq('category_area', id);

                        // Update courses
                        await supabaseAdmin
                            .from('courses')
                            .update({ category_area: newAreaId })
                            .eq('category_area', id);
                    }

                    // Delete area (cascades to specialties and focuses)
                    const { error } = await supabaseAdmin
                        .from('taxonomy_areas')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }

                if (entity === 'type') {
                    // If reassign_to provided, move courses to new type
                    if (reassign_to) {
                        // Update course_categories
                        await supabaseAdmin
                            .from('course_categories')
                            .update({ category_type: reassign_to })
                            .eq('category_type', id);

                        // Update courses
                        await supabaseAdmin
                            .from('courses')
                            .update({ category_type: reassign_to })
                            .eq('category_type', id);
                    }

                    // Delete type (cascades to areas, specialties and focuses)
                    const { error } = await supabaseAdmin
                        .from('taxonomy_types')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
            }

            // --- COUNT COURSES (for delete confirmation) ---
            if (action === 'count_courses') {
                let count = 0;

                if (entity === 'focus') {
                    // Get focus name
                    const { data: focusItem } = await supabaseAdmin
                        .from('taxonomy_focus')
                        .select('name')
                        .eq('id', data.id)
                        .single();

                    if (focusItem) {
                        const { count: c } = await supabaseAdmin
                            .from('course_categories')
                            .select('*', { count: 'exact', head: true })
                            .eq('category_focus', focusItem.name);
                        count = c || 0;
                    }
                }

                if (entity === 'specialty') {
                    // Get specialty name
                    const { data: spec } = await supabaseAdmin
                        .from('taxonomy_specialties')
                        .select('name')
                        .eq('id', data.id)
                        .single();

                    if (spec) {
                        const { count: c } = await supabaseAdmin
                            .from('course_categories')
                            .select('*', { count: 'exact', head: true })
                            .eq('category_specialty', spec.name);
                        count = c || 0;
                    }
                }

                if (entity === 'area') {
                    const { count: c } = await supabaseAdmin
                        .from('course_categories')
                        .select('*', { count: 'exact', head: true })
                        .eq('category_area', data.id);
                    count = c || 0;
                }

                if (entity === 'type') {
                    const { count: c } = await supabaseAdmin
                        .from('course_categories')
                        .select('*', { count: 'exact', head: true })
                        .eq('category_type', data.id);
                    count = c || 0;
                }

                return res.status(200).json({ count });
            }

            return res.status(400).json({ error: 'Invalid action' });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
