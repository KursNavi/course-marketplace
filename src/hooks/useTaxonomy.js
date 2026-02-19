import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { NEW_TAXONOMY, CATEGORY_TYPES } from '../lib/constants';

// Cache for taxonomy data
let taxonomyCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to load taxonomy from database with fallback to constants.js
 * Supports both v2 (numeric IDs) and legacy (text IDs) table structures
 * Returns the taxonomy in a normalized format for components
 * Hierarchy: Type → Area → Specialty → Focus (Level 4)
 */
export function useTaxonomy() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [taxonomy, setTaxonomy] = useState(null);
    const [types, setTypes] = useState([]);
    const [areas, setAreas] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [focuses, setFocuses] = useState([]);
    const [isV2, setIsV2] = useState(false); // Track which schema we're using

    const loadTaxonomy = useCallback(async (forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh && taxonomyCache && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
            setTaxonomy(taxonomyCache.taxonomy);
            setTypes(taxonomyCache.types);
            setAreas(taxonomyCache.areas);
            setSpecialties(taxonomyCache.specialties);
            setFocuses(taxonomyCache.focuses || []);
            setIsV2(taxonomyCache.isV2 || false);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Try to load from v2 tables first (numeric IDs)
            const v2TypesRes = await supabase.from('taxonomy_types_v2').select('*').order('sort_order');

            if (v2TypesRes.data?.length > 0 && !v2TypesRes.error) {
                // V2 schema exists - use it
                await loadV2Taxonomy();
            } else {
                // Fall back to legacy schema (text IDs)
                await loadLegacyTaxonomy();
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

    // Load from v2 tables (numeric IDs)
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
                _meta: type, // Store full type object
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
                    _meta: area, // Store full area object
                    label: {
                        de: area.label_de,
                        en: area.label_en || area.label_de,
                        fr: area.label_fr || area.label_de,
                        it: area.label_it || area.label_de
                    },
                    specialties: specialtyObjects.map(s => s.label_de), // For backward compatibility (already sorted)
                    specialtyObjects, // New: full objects with IDs (already sorted)
                    specialtyFocuses: Object.fromEntries(
                        specialtyObjects.map(s => [s.label_de, s.focuses.map(f => f.label_de)])
                    )
                };

                // Store by numeric ID only - slug is stored in _areaIds for lookup
                typeData[area.id] = areaData;
                // Also store by slug for backward compatibility with legacy course data
                if (area.slug) {
                    typeData[area.slug] = areaData;
                }
            });

            // Store ordered area IDs for getAreas() - only numeric IDs, no duplicates
            typeData._areaIds = typeAreas.map(a => a.id);

            // Store type by numeric ID
            builtTaxonomy[type.id] = typeData;
            // Also store by slug for backward compatibility with legacy course data
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
            isV2: true
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(dbTypes);
        setAreas(dbAreas);
        setSpecialties(dbSpecialties);
        setFocuses(dbFocuses);
        setIsV2(true);
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
                        // Sort focuses alphabetically
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

            // Store ordered area IDs
            typeData._areaIds = typeAreas.map(a => a.id);
            builtTaxonomy[type.id] = typeData;
        });

        taxonomyCache = {
            taxonomy: builtTaxonomy,
            types: dbTypes,
            areas: dbAreas,
            specialties: dbSpecialties,
            focuses: dbFocuses,
            isV2: false
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(dbTypes);
        setAreas(dbAreas);
        setSpecialties(dbSpecialties);
        setFocuses(dbFocuses);
        setIsV2(false);
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

        // Build taxonomy with _areaIds for consistent getAreas() behavior
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
            isV2: false
        };
        cacheTimestamp = Date.now();

        setTaxonomy(builtTaxonomy);
        setTypes(fallbackTypes);
        setAreas(fallbackAreas);
        setSpecialties(fallbackSpecialties);
        setFocuses([]);
        setIsV2(false);
    };

    useEffect(() => {
        loadTaxonomy();
    }, [loadTaxonomy]);

    // Helper: Get areas for a type (returns area IDs, sorted alphabetically)
    const getAreas = useCallback((typeId) => {
        if (!taxonomy || !typeId) return [];
        const typeData = taxonomy[typeId];
        if (!typeData) return [];

        // If we have pre-sorted _areaIds (v2), use those to avoid duplicates
        if (typeData._areaIds) {
            return typeData._areaIds;
        }

        // Fallback for legacy: filter out special keys and sort by label
        const areaKeys = Object.keys(typeData).filter(k =>
            k !== '_meta' && k !== 'label' && k !== '_areaIds' &&
            // Only include numeric IDs or slugs that don't have a corresponding numeric entry
            (typeof k === 'number' || !typeData[k]?._meta?.id || String(typeData[k]._meta.id) === k)
        );

        // Sort by label alphabetically
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

    // Helper: Get specialty objects with IDs (v2 only)
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
        // For v2, typeId is numeric - find by id
        // For legacy, typeId is string - find by id
        const type = types.find(t => t.id === typeId || t.id === Number(typeId));
        if (!type) {
            // Try taxonomy structure
            if (taxonomy?.[typeId]?.label) {
                return taxonomy[typeId].label[lang] || taxonomy[typeId].label.de || typeId;
            }
            return typeId;
        }
        return type[`label_${lang}`] || type.label_de || typeId;
    }, [types, taxonomy]);

    // Helper: Get area by ID (for v2)
    const getAreaById = useCallback((areaId) => {
        return areas.find(a => a.id === areaId || a.id === Number(areaId));
    }, [areas]);

    // Helper: Get specialty by ID (for v2)
    const getSpecialtyById = useCallback((specialtyId) => {
        return specialties.find(s => s.id === specialtyId || s.id === Number(specialtyId));
    }, [specialties]);

    // Helper: Get focus by ID (for v2)
    const getFocusById = useCallback((focusId) => {
        return focuses.find(f => f.id === focusId || f.id === Number(focusId));
    }, [focuses]);

    // Helper: Get type by ID
    const getTypeById = useCallback((typeId) => {
        return types.find(t => t.id === typeId || t.id === Number(typeId));
    }, [types]);

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
        isV2, // Components can check this to know which schema is active
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
        refresh
    };
}

// Export cache invalidation for admin operations
export function invalidateTaxonomyCache() {
    taxonomyCache = null;
    cacheTimestamp = 0;
}
