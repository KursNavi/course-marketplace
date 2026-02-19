import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { NEW_TAXONOMY, CATEGORY_TYPES } from '../lib/constants';

// Cache for taxonomy data
let taxonomyCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to load taxonomy from database with fallback to constants.js
 * Supports consolidated schema (taxonomy_level1/2/3/4) with legacy fallback
 * Returns the taxonomy in a normalized format for components
 * Hierarchy: Level1 (Type) → Level2 (Area) → Level3 (Specialty) → Level4 (Focus)
 */
export function useTaxonomy() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [taxonomy, setTaxonomy] = useState(null);
    const [types, setTypes] = useState([]);
    const [areas, setAreas] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [focuses, setFocuses] = useState([]);
    const [schemaVersion, setSchemaVersion] = useState(null); // 'consolidated', 'v2', 'legacy'

    const loadTaxonomy = useCallback(async (forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh && taxonomyCache && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
            setTaxonomy(taxonomyCache.taxonomy);
            setTypes(taxonomyCache.types);
            setAreas(taxonomyCache.areas);
            setSpecialties(taxonomyCache.specialties);
            setFocuses(taxonomyCache.focuses || []);
            setSchemaVersion(taxonomyCache.schemaVersion || 'legacy');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Try consolidated schema first (taxonomy_level1/2/3/4)
            const consolidatedRes = await supabase.from('taxonomy_level1').select('*').order('sort_order');

            if (consolidatedRes.data?.length > 0 && !consolidatedRes.error) {
                await loadConsolidatedTaxonomy();
            } else {
                // Try v2 schema (taxonomy_types_v2 etc.)
                const v2TypesRes = await supabase.from('taxonomy_types_v2').select('*').order('sort_order');

                if (v2TypesRes.data?.length > 0 && !v2TypesRes.error) {
                    await loadV2Taxonomy();
                } else {
                    // Fall back to legacy schema (text IDs)
                    await loadLegacyTaxonomy();
                }
            }
        } catch (err) {
            console.error('Error loading taxonomy:', err);
            setError(err.message);
            // Ultimate fallback to constants
            loadConstantsFallback();
        } finally {
            setLoading(false);
        }
    }, []);

    // Load from consolidated tables (taxonomy_level1/2/3/4)
    const loadConsolidatedTaxonomy = async () => {
        const [level1Res, level2Res, level3Res, level4Res] = await Promise.all([
            supabase.from('taxonomy_level1').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('taxonomy_level2').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('taxonomy_level3').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('taxonomy_level4').select('*').eq('is_active', true).order('sort_order')
        ]);

        const dbLevel1 = level1Res.data || [];
        const dbLevel2 = level2Res.data || [];
        const dbLevel3 = level3Res.data || [];
        const dbLevel4 = level4Res.data || [];

        // Build taxonomy structure
        const builtTaxonomy = {};

        // Build focus lookup: level3_id -> focus objects
        const focusByLevel3Id = {};
        dbLevel4.forEach(f => {
            if (!focusByLevel3Id[f.level3_id]) focusByLevel3Id[f.level3_id] = [];
            focusByLevel3Id[f.level3_id].push(f);
        });

        dbLevel1.forEach(level1 => {
            const typeData = {
                _meta: { ...level1, id: level1.id },
                label: {
                    de: level1.label_de,
                    en: level1.label_en || level1.label_de,
                    fr: level1.label_fr || level1.label_de,
                    it: level1.label_it || level1.label_de
                }
            };

            // Find level2 items for this level1 and sort alphabetically
            const level1Areas = dbLevel2
                .filter(a => a.level1_id === level1.id)
                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'));

            level1Areas.forEach(level2 => {
                // Find level3 items for this level2 and sort alphabetically
                const level2Specs = dbLevel3
                    .filter(s => s.level2_id === level2.id)
                    .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'));

                // Build specialty objects with their focuses (sorted)
                const specialtyObjects = level2Specs.map(s => ({
                    id: s.id,
                    slug: s.slug,
                    label_de: s.label_de,
                    label_en: s.label_en || s.label_de,
                    label_fr: s.label_fr || s.label_de,
                    label_it: s.label_it || s.label_de,
                    focuses: (focusByLevel3Id[s.id] || [])
                        .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
                }));

                const areaData = {
                    _meta: { ...level2, id: level2.id },
                    label: {
                        de: level2.label_de,
                        en: level2.label_en || level2.label_de,
                        fr: level2.label_fr || level2.label_de,
                        it: level2.label_it || level2.label_de
                    },
                    specialties: specialtyObjects.map(s => s.label_de), // For backward compatibility
                    specialtyObjects, // Full objects with IDs
                    specialtyFocuses: Object.fromEntries(
                        specialtyObjects.map(s => [s.label_de, s.focuses.map(f => f.label_de)])
                    )
                };

                // Store by numeric ID
                typeData[level2.id] = areaData;
                // Also store by slug for backward compatibility
                if (level2.slug) {
                    typeData[level2.slug] = areaData;
                }
            });

            // Store ordered area IDs for getAreas()
            typeData._areaIds = level1Areas.map(a => a.id);

            // Store type by numeric ID
            builtTaxonomy[level1.id] = typeData;
            // Also store by slug for backward compatibility
            if (level1.slug) {
                builtTaxonomy[level1.slug] = typeData;
            }
        });

        // Map to types/areas/specialties format for compatibility
        const mappedTypes = dbLevel1.map(t => ({
            id: t.id,
            slug: t.slug,
            label_de: t.label_de,
            label_en: t.label_en,
            label_fr: t.label_fr,
            label_it: t.label_it,
            icon: t.icon,
            sort_order: t.sort_order
        }));

        const mappedAreas = dbLevel2.map(a => ({
            id: a.id,
            type_id: a.level1_id,
            level1_id: a.level1_id,
            slug: a.slug,
            label_de: a.label_de,
            label_en: a.label_en,
            label_fr: a.label_fr,
            label_it: a.label_it,
            icon: a.icon,
            sort_order: a.sort_order
        }));

        const mappedSpecialties = dbLevel3.map(s => ({
            id: s.id,
            area_id: s.level2_id,
            level2_id: s.level2_id,
            slug: s.slug,
            name: s.label_de, // Legacy compatibility
            label_de: s.label_de,
            label_en: s.label_en,
            label_fr: s.label_fr,
            label_it: s.label_it,
            sort_order: s.sort_order
        }));

        const mappedFocuses = dbLevel4.map(f => ({
            id: f.id,
            specialty_id: f.level3_id,
            level3_id: f.level3_id,
            slug: f.slug,
            name: f.label_de, // Legacy compatibility
            label_de: f.label_de,
            label_en: f.label_en,
            label_fr: f.label_fr,
            label_it: f.label_it,
            sort_order: f.sort_order
        }));

        // Update cache
        taxonomyCache = {
            taxonomy: builtTaxonomy,
            types: mappedTypes,
            areas: mappedAreas,
            specialties: mappedSpecialties,
            focuses: mappedFocuses,
            schemaVersion: 'consolidated'
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(mappedTypes);
        setAreas(mappedAreas);
        setSpecialties(mappedSpecialties);
        setFocuses(mappedFocuses);
        setSchemaVersion('consolidated');
        setError(null);
    };

    // Load from v2 tables (numeric IDs) - legacy support
    const loadV2Taxonomy = async () => {
        const [typesRes, areasRes, specialtiesRes, focusesRes] = await Promise.all([
            supabase.from('taxonomy_types_v2').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('taxonomy_areas_v2').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('taxonomy_specialties_v2').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('taxonomy_focus_v2').select('*').eq('is_active', true).order('sort_order')
        ]);

        const dbTypes = typesRes.data || [];
        const dbAreas = areasRes.data || [];
        const dbSpecialties = specialtiesRes.data || [];
        const dbFocuses = focusesRes.data || [];

        // Build taxonomy structure keyed by numeric ID
        const builtTaxonomy = {};

        // Build focus lookup: specialty_id -> focus objects
        const focusBySpecialtyId = {};
        dbFocuses.forEach(f => {
            if (!focusBySpecialtyId[f.specialty_id]) focusBySpecialtyId[f.specialty_id] = [];
            focusBySpecialtyId[f.specialty_id].push(f);
        });

        dbTypes.forEach(type => {
            const typeData = {
                _meta: type,
                label: {
                    de: type.label_de,
                    en: type.label_en || type.label_de,
                    fr: type.label_fr || type.label_de,
                    it: type.label_it || type.label_de
                }
            };

            // Find areas for this type and sort alphabetically by label
            const typeAreas = dbAreas
                .filter(a => a.type_id === type.id)
                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'));

            typeAreas.forEach(area => {
                // Find specialties for this area and sort alphabetically by label
                const areaSpecs = dbSpecialties
                    .filter(s => s.area_id === area.id)
                    .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'));

                // Build specialty objects with their focuses (sorted)
                const specialtyObjects = areaSpecs.map(s => ({
                    id: s.id,
                    slug: s.slug,
                    label_de: s.label_de,
                    label_en: s.label_en || s.label_de,
                    label_fr: s.label_fr || s.label_de,
                    label_it: s.label_it || s.label_de,
                    focuses: (focusBySpecialtyId[s.id] || [])
                        .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
                }));

                const areaData = {
                    _meta: area,
                    label: {
                        de: area.label_de,
                        en: area.label_en || area.label_de,
                        fr: area.label_fr || area.label_de,
                        it: area.label_it || area.label_de
                    },
                    specialties: specialtyObjects.map(s => s.label_de),
                    specialtyObjects,
                    specialtyFocuses: Object.fromEntries(
                        specialtyObjects.map(s => [s.label_de, s.focuses.map(f => f.label_de)])
                    )
                };

                typeData[area.id] = areaData;
                if (area.slug) {
                    typeData[area.slug] = areaData;
                }
            });

            typeData._areaIds = typeAreas.map(a => a.id);
            builtTaxonomy[type.id] = typeData;
            if (type.slug) {
                builtTaxonomy[type.slug] = typeData;
            }
        });

        // Update cache
        taxonomyCache = {
            taxonomy: builtTaxonomy,
            types: dbTypes,
            areas: dbAreas,
            specialties: dbSpecialties,
            focuses: dbFocuses,
            schemaVersion: 'v2'
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(dbTypes);
        setAreas(dbAreas);
        setSpecialties(dbSpecialties);
        setFocuses(dbFocuses);
        setSchemaVersion('v2');
        setError(null);
    };

    // Load from legacy tables (text IDs)
    const loadLegacyTaxonomy = async () => {
        const [typesRes, areasRes, specialtiesRes, focusesRes] = await Promise.all([
            supabase.from('taxonomy_types').select('*').order('sort_order'),
            supabase.from('taxonomy_areas').select('*').order('sort_order'),
            supabase.from('taxonomy_specialties').select('*').order('sort_order'),
            supabase.from('taxonomy_focus').select('*').order('sort_order')
        ]);

        const hasDBData = typesRes.data?.length > 0;

        if (!hasDBData || typesRes.error || areasRes.error || specialtiesRes.error) {
            loadConstantsFallback();
            return;
        }

        const dbTypes = typesRes.data;
        const dbAreas = areasRes.data;
        const dbSpecialties = specialtiesRes.data;
        const dbFocuses = (focusesRes.error ? [] : focusesRes.data) || [];

        // Build compatible structure
        const builtTaxonomy = {};

        // Build focus lookup: specialty_id -> focus names
        const focusBySpecialtyId = {};
        dbFocuses.forEach(f => {
            if (!focusBySpecialtyId[f.specialty_id]) focusBySpecialtyId[f.specialty_id] = [];
            focusBySpecialtyId[f.specialty_id].push(f.name);
        });

        dbTypes.forEach(type => {
            const typeData = {
                _meta: type,
                label: {
                    de: type.label_de,
                    en: type.label_en || type.label_de,
                    fr: type.label_fr || type.label_de,
                    it: type.label_it || type.label_de
                }
            };

            // Sort areas alphabetically by label
            const typeAreas = dbAreas
                .filter(a => a.type_id === type.id)
                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'));

            typeAreas.forEach(area => {
                // Sort specialties alphabetically by name
                const areaSpecs = dbSpecialties
                    .filter(s => s.area_id === area.id)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));

                const specialtyNames = areaSpecs.map(s => s.name);

                const specialtyFocuses = {};
                areaSpecs.forEach(s => {
                    const fList = focusBySpecialtyId[s.id];
                    if (fList && fList.length > 0) {
                        specialtyFocuses[s.name] = [...fList].sort((a, b) => a.localeCompare(b, 'de'));
                    }
                });

                typeData[area.id] = {
                    _meta: area,
                    label: {
                        de: area.label_de,
                        en: area.label_en || area.label_de,
                        fr: area.label_fr || area.label_de,
                        it: area.label_it || area.label_de
                    },
                    specialties: specialtyNames,
                    specialtyFocuses
                };
            });

            typeData._areaIds = typeAreas.map(a => a.id);
            builtTaxonomy[type.id] = typeData;
        });

        taxonomyCache = {
            taxonomy: builtTaxonomy,
            types: dbTypes,
            areas: dbAreas,
            specialties: dbSpecialties,
            focuses: dbFocuses,
            schemaVersion: 'legacy'
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(dbTypes);
        setAreas(dbAreas);
        setSpecialties(dbSpecialties);
        setFocuses(dbFocuses);
        setSchemaVersion('legacy');
        setError(null);
    };

    // Fallback to constants.js
    const loadConstantsFallback = () => {
        console.warn('Using fallback taxonomy from constants.js');

        const fallbackTypes = Object.entries(CATEGORY_TYPES).map(([id, labels], idx) => ({
            id,
            label_de: labels.de,
            label_en: labels.en,
            label_fr: labels.fr,
            label_it: labels.it,
            sort_order: idx
        }));

        const fallbackAreas = [];
        const fallbackSpecialties = [];
        let specSort = 0;

        const builtTaxonomy = {};

        Object.entries(NEW_TAXONOMY).forEach(([typeId, typeAreas]) => {
            builtTaxonomy[typeId] = {
                label: CATEGORY_TYPES[typeId] ? {
                    de: CATEGORY_TYPES[typeId].de,
                    en: CATEGORY_TYPES[typeId].en,
                    fr: CATEGORY_TYPES[typeId].fr,
                    it: CATEGORY_TYPES[typeId].it
                } : { de: typeId }
            };

            // Sort areas alphabetically by label
            const sortedAreaEntries = Object.entries(typeAreas)
                .sort(([, a], [, b]) => (a.label?.de || '').localeCompare(b.label?.de || '', 'de'));

            const areaIds = [];
            sortedAreaEntries.forEach(([areaId, areaData]) => {
                areaIds.push(areaId);
                fallbackAreas.push({
                    id: areaId,
                    type_id: typeId,
                    label_de: areaData.label.de,
                    label_en: areaData.label.en,
                    label_fr: areaData.label.fr,
                    label_it: areaData.label.it
                });

                // Sort specialties alphabetically
                const sortedSpecialties = [...areaData.specialties].sort((a, b) => a.localeCompare(b, 'de'));

                sortedSpecialties.forEach((name) => {
                    fallbackSpecialties.push({
                        id: specSort++,
                        area_id: areaId,
                        name,
                        label_de: name
                    });
                });

                builtTaxonomy[typeId][areaId] = {
                    label: areaData.label,
                    specialties: sortedSpecialties,
                    specialtyFocuses: areaData.specialtyFocuses || {}
                };
            });

            builtTaxonomy[typeId]._areaIds = areaIds;
        });

        taxonomyCache = {
            taxonomy: builtTaxonomy,
            types: fallbackTypes,
            areas: fallbackAreas,
            specialties: fallbackSpecialties,
            focuses: [],
            schemaVersion: 'fallback'
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(fallbackTypes);
        setAreas(fallbackAreas);
        setSpecialties(fallbackSpecialties);
        setFocuses([]);
        setSchemaVersion('fallback');
    };

    useEffect(() => {
        loadTaxonomy();
    }, [loadTaxonomy]);

    // Helper: Get areas for a type (returns area IDs, sorted alphabetically)
    const getAreas = useCallback((typeId) => {
        if (!taxonomy || !typeId) return [];
        const typeData = taxonomy[typeId];
        if (!typeData) return [];

        // If we have pre-sorted _areaIds, use those to avoid duplicates
        if (typeData._areaIds) {
            return typeData._areaIds;
        }

        // Fallback: filter out special keys and sort by label
        const areaKeys = Object.keys(typeData).filter(k =>
            k !== '_meta' && k !== 'label' && k !== '_areaIds' &&
            (typeof k === 'number' || !typeData[k]?._meta?.id || String(typeData[k]._meta.id) === k)
        );

        return areaKeys.sort((a, b) => {
            const labelA = typeData[a]?.label?.de || '';
            const labelB = typeData[b]?.label?.de || '';
            return labelA.localeCompare(labelB, 'de');
        });
    }, [taxonomy]);

    // Helper: Get specialties for an area (returns specialty names/labels)
    const getSpecialties = useCallback((typeId, areaId) => {
        if (!taxonomy || !typeId || !areaId) return [];
        return taxonomy[typeId]?.[areaId]?.specialties || [];
    }, [taxonomy]);

    // Helper: Get specialty objects with IDs
    const getSpecialtyObjects = useCallback((typeId, areaId) => {
        if (!taxonomy || !typeId || !areaId) return [];
        return taxonomy[typeId]?.[areaId]?.specialtyObjects || [];
    }, [taxonomy]);

    // Helper: Get focuses for a specialty
    const getFocuses = useCallback((typeId, areaId, specialtyName) => {
        if (!taxonomy || !typeId || !areaId || !specialtyName) return [];
        return taxonomy[typeId]?.[areaId]?.specialtyFocuses?.[specialtyName] || [];
    }, [taxonomy]);

    // Helper: Get area label
    const getAreaLabel = useCallback((typeId, areaId, lang = 'de') => {
        if (!taxonomy || !typeId || !areaId) return areaId;
        return taxonomy[typeId]?.[areaId]?.label?.[lang] || areaId;
    }, [taxonomy]);

    // Helper: Get type label
    const getTypeLabel = useCallback((typeId, lang = 'de') => {
        const type = types.find(t => t.id === typeId || t.id === Number(typeId) || t.slug === typeId);
        if (!type) {
            if (taxonomy?.[typeId]?.label) {
                return taxonomy[typeId].label[lang] || taxonomy[typeId].label.de || typeId;
            }
            return typeId;
        }
        return type[`label_${lang}`] || type.label_de || typeId;
    }, [types, taxonomy]);

    // Helper: Get area by ID
    const getAreaById = useCallback((areaId) => {
        return areas.find(a => a.id === areaId || a.id === Number(areaId));
    }, [areas]);

    // Helper: Get specialty by ID
    const getSpecialtyById = useCallback((specialtyId) => {
        return specialties.find(s => s.id === specialtyId || s.id === Number(specialtyId));
    }, [specialties]);

    // Helper: Get focus by ID
    const getFocusById = useCallback((focusId) => {
        return focuses.find(f => f.id === focusId || f.id === Number(focusId));
    }, [focuses]);

    // Helper: Get type by ID
    const getTypeById = useCallback((typeId) => {
        return types.find(t => t.id === typeId || t.id === Number(typeId) || t.slug === typeId);
    }, [types]);

    // Helper: Get full path for a level3 ID (returns { level1, level2, level3, level4 })
    const getFullPath = useCallback((level3Id, level4Id = null) => {
        const specialty = specialties.find(s => s.id === level3Id || s.id === Number(level3Id));
        if (!specialty) return null;

        const areaId = specialty.area_id || specialty.level2_id;
        const area = areas.find(a => a.id === areaId);
        if (!area) return null;

        const typeId = area.type_id || area.level1_id;
        const type = types.find(t => t.id === typeId);
        if (!type) return null;

        const focus = level4Id ? focuses.find(f => f.id === level4Id || f.id === Number(level4Id)) : null;

        return {
            level1: type,
            level2: area,
            level3: specialty,
            level4: focus,
            // Legacy aliases
            type,
            area,
            specialty,
            focus
        };
    }, [types, areas, specialties, focuses]);

    // Force refresh cache
    const refresh = useCallback(() => {
        taxonomyCache = null;
        cacheTimestamp = 0;
        loadTaxonomy(true);
    }, [loadTaxonomy]);

    return {
        loading,
        error,
        taxonomy,
        types,
        areas,
        specialties,
        focuses,
        schemaVersion,
        // Legacy alias for backward compatibility
        isV2: schemaVersion === 'v2' || schemaVersion === 'consolidated',
        // Helpers
        getAreas,
        getSpecialties,
        getSpecialtyObjects,
        getFocuses,
        getAreaLabel,
        getTypeLabel,
        getAreaById,
        getSpecialtyById,
        getFocusById,
        getTypeById,
        getFullPath,
        refresh
    };
}

// Export cache invalidation for admin operations
export function invalidateTaxonomyCache() {
    taxonomyCache = null;
    cacheTimestamp = 0;
}
