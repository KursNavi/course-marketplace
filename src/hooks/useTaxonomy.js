import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { NEW_TAXONOMY, CATEGORY_TYPES } from '../lib/constants';

// Cache for taxonomy data
let taxonomyCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to load taxonomy from database with fallback to constants.js
 * Returns the taxonomy in the same format as NEW_TAXONOMY for compatibility
 */
export function useTaxonomy() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [taxonomy, setTaxonomy] = useState(null);
    const [types, setTypes] = useState([]);
    const [areas, setAreas] = useState([]);
    const [specialties, setSpecialties] = useState([]);

    const loadTaxonomy = useCallback(async (forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh && taxonomyCache && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
            setTaxonomy(taxonomyCache.taxonomy);
            setTypes(taxonomyCache.types);
            setAreas(taxonomyCache.areas);
            setSpecialties(taxonomyCache.specialties);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Load from database
            const [typesRes, areasRes, specialtiesRes] = await Promise.all([
                supabase.from('taxonomy_types').select('*').order('sort_order'),
                supabase.from('taxonomy_areas').select('*').order('sort_order'),
                supabase.from('taxonomy_specialties').select('*').order('sort_order')
            ]);

            // Check if we have data
            const hasDBData = typesRes.data?.length > 0;

            if (hasDBData && !typesRes.error && !areasRes.error && !specialtiesRes.error) {
                // Build taxonomy structure from DB
                const dbTypes = typesRes.data;
                const dbAreas = areasRes.data;
                const dbSpecialties = specialtiesRes.data;

                // Build compatible structure like NEW_TAXONOMY
                const builtTaxonomy = {};
                const categoryTypes = {};

                dbTypes.forEach(type => {
                    categoryTypes[type.id] = {
                        de: type.label_de,
                        en: type.label_en || type.label_de,
                        fr: type.label_fr || type.label_de,
                        it: type.label_it || type.label_de
                    };

                    builtTaxonomy[type.id] = {};

                    // Find areas for this type
                    const typeAreas = dbAreas.filter(a => a.type_id === type.id);
                    typeAreas.forEach(area => {
                        // Find specialties for this area
                        const areaSpecs = dbSpecialties
                            .filter(s => s.area_id === area.id)
                            .map(s => s.name);

                        builtTaxonomy[type.id][area.id] = {
                            label: {
                                de: area.label_de,
                                en: area.label_en || area.label_de,
                                fr: area.label_fr || area.label_de,
                                it: area.label_it || area.label_de
                            },
                            specialties: areaSpecs
                        };
                    });
                });

                // Update cache
                taxonomyCache = {
                    taxonomy: builtTaxonomy,
                    categoryTypes,
                    types: dbTypes,
                    areas: dbAreas,
                    specialties: dbSpecialties
                };
                cacheTimestamp = Date.now();

                setTaxonomy(builtTaxonomy);
                setTypes(dbTypes);
                setAreas(dbAreas);
                setSpecialties(dbSpecialties);
                setError(null);
            } else {
                // Fallback to constants.js
                console.warn('Using fallback taxonomy from constants.js');

                // Convert constants to flat arrays for consistency
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
                let areaSort = 0;
                let specSort = 0;

                Object.entries(NEW_TAXONOMY).forEach(([typeId, typeAreas]) => {
                    Object.entries(typeAreas).forEach(([areaId, areaData]) => {
                        fallbackAreas.push({
                            id: areaId,
                            type_id: typeId,
                            label_de: areaData.label.de,
                            label_en: areaData.label.en,
                            label_fr: areaData.label.fr,
                            label_it: areaData.label.it,
                            sort_order: areaSort++
                        });

                        areaData.specialties.forEach((name, idx) => {
                            fallbackSpecialties.push({
                                id: specSort++,
                                area_id: areaId,
                                name,
                                sort_order: idx
                            });
                        });
                    });
                });

                taxonomyCache = {
                    taxonomy: NEW_TAXONOMY,
                    categoryTypes: CATEGORY_TYPES,
                    types: fallbackTypes,
                    areas: fallbackAreas,
                    specialties: fallbackSpecialties
                };
                cacheTimestamp = Date.now();

                setTaxonomy(NEW_TAXONOMY);
                setTypes(fallbackTypes);
                setAreas(fallbackAreas);
                setSpecialties(fallbackSpecialties);
            }
        } catch (err) {
            console.error('Error loading taxonomy:', err);
            setError(err.message);

            // Fallback to constants
            setTaxonomy(NEW_TAXONOMY);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTaxonomy();
    }, [loadTaxonomy]);

    // Helper: Get areas for a type
    const getAreas = useCallback((typeId) => {
        if (!taxonomy || !typeId) return [];
        return Object.keys(taxonomy[typeId] || {});
    }, [taxonomy]);

    // Helper: Get specialties for an area
    const getSpecialties = useCallback((typeId, areaId) => {
        if (!taxonomy || !typeId || !areaId) return [];
        return taxonomy[typeId]?.[areaId]?.specialties || [];
    }, [taxonomy]);

    // Helper: Get area label
    const getAreaLabel = useCallback((typeId, areaId, lang = 'de') => {
        if (!taxonomy || !typeId || !areaId) return areaId;
        return taxonomy[typeId]?.[areaId]?.label?.[lang] || areaId;
    }, [taxonomy]);

    // Helper: Get type label
    const getTypeLabel = useCallback((typeId, lang = 'de') => {
        const type = types.find(t => t.id === typeId);
        if (!type) return typeId;
        return type[`label_${lang}`] || type.label_de || typeId;
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
        getAreas,
        getSpecialties,
        getAreaLabel,
        getTypeLabel,
        refresh
    };
}

// Export cache invalidation for admin operations
export function invalidateTaxonomyCache() {
    taxonomyCache = null;
    cacheTimestamp = 0;
}
