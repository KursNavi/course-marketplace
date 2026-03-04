-- ============================================
-- Migration: Finalize Yoga & Achtsamkeit taxonomy cleanup
-- Date: 2026-03-04
-- ============================================
-- Enforces target taxonomy under level2 slug "yoga_achtsamkeit":
-- - Only 7 level3 nodes remain active and present
-- - Legacy level3/level4 nodes are removed
-- - Only allowed level4 nodes remain active
-- - Materialized taxonomy paths are refreshed
-- ============================================

DO $$
DECLARE
    v_level2_yoga_id INT;
BEGIN
    SELECT id INTO v_level2_yoga_id
    FROM taxonomy_level2
    WHERE slug = 'yoga_achtsamkeit'
    LIMIT 1;

    IF v_level2_yoga_id IS NULL THEN
        RAISE EXCEPTION 'taxonomy_level2 slug="yoga_achtsamkeit" not found';
    END IF;

    -- 1) Ensure exactly the target Level-3 set is active
    UPDATE taxonomy_level3
    SET is_active = CASE
        WHEN slug IN (
            'yoga',
            'meditation_achtsamkeit',
            'atemarbeit',
            'klang_mantra',
            'somatics_koerperbewusstsein',
            'energiearbeit',
            'bodywork_massage'
        ) THEN true
        ELSE false
    END,
    updated_at = NOW()
    WHERE level2_id = v_level2_yoga_id;

    -- 2) Delete obsolete Level-3 nodes physically (and cascading legacy level4 children)
    DELETE FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id
      AND slug IN (
        'mental_health',
        'mental_meditation',
        'koerperarbeit',
        'personlichkeitsentwicklung',
        'persoenlichkeitsentwicklung',
        'persoenlichkeit'
      );

    -- 3) Remove residual legacy Level-4 nodes under Yoga & Achtsamkeit
    DELETE FROM taxonomy_level4 l4
    USING taxonomy_level3 l3
    WHERE l3.id = l4.level3_id
      AND l3.level2_id = v_level2_yoga_id
      AND (
        l4.slug IN (
            'hatha_flow_vinyasa',
            'wasser_yoga',
            'meditation_achtsamkeit',
            'klang_atemreise',
            'reiki_chakra',
            'feldenkrais_pilates',
            'resilienz_coaching',
            'kausaltraining'
        )
        OR (l4.slug = 'yoga_nidra' AND l3.slug = 'yoga')
        OR (l4.slug = 'massage_wellness' AND l3.slug = 'somatics_koerperbewusstsein')
      );

    -- 4) Ensure allowed Level-4 entries under each active Level-3 are active, others inactive
    UPDATE taxonomy_level4 l4
    SET is_active = CASE
        WHEN l3.slug = 'yoga' AND l4.slug IN (
            'hatha_grundlagen', 'vinyasa_flow', 'yin_restorative', 'power_ashtanga', 'kundalini',
            'alignment_iyengar_ausrichtung', 'therapeutisches_yoga', 'wasser_sup_yoga', 'hot_yoga', 'aerial_acro_chair'
        ) THEN true
        WHEN l3.slug = 'meditation_achtsamkeit' AND l4.slug IN (
            'achtsamkeitstraining_mbsr_alltag', 'gefuehrte_meditation', 'stille_meditation', 'yoga_nidra', 'metta_selbstmitgefuehl'
        ) THEN true
        WHEN l3.slug = 'atemarbeit' AND l4.slug IN ('pranayama', 'breathwork', 'atemreise') THEN true
        WHEN l3.slug = 'klang_mantra' AND l4.slug IN (
            'klangmeditation_sound_bath', 'gong_klanginstrumente', 'mantra_kirtan', 'klangreise', 'rhythmus_trommeln'
        ) THEN true
        WHEN l3.slug = 'somatics_koerperbewusstsein' AND l4.slug IN (
            'feldenkrais', 'pilates_yoga_pilates', 'embodiment_somatic_movement', 'faszien_mobility', 'entspannungsverfahren_pmr_autogen'
        ) THEN true
        WHEN l3.slug = 'energiearbeit' AND l4.slug IN ('reiki', 'chakra_energiezentren', 'energieheilung_healing') THEN true
        WHEN l3.slug = 'bodywork_massage' AND l4.slug IN ('thai_yoga_massage', 'massage_wellness', 'koerpertherapie') THEN true
        ELSE false
    END,
    updated_at = NOW()
    FROM taxonomy_level3 l3
    WHERE l3.id = l4.level3_id
      AND l3.level2_id = v_level2_yoga_id;

    -- 5) Refresh taxonomy materialized view (if present)
    BEGIN
        PERFORM refresh_taxonomy_paths_manual();
    EXCEPTION
        WHEN undefined_function THEN
            BEGIN
                REFRESH MATERIALIZED VIEW v_taxonomy_paths;
            EXCEPTION
                WHEN undefined_table THEN
                    NULL;
            END;
    END;
END $$;

-- ============================================
-- Optional verification
-- ============================================
-- SELECT id, slug, label_de, is_active
-- FROM taxonomy_level3
-- WHERE level2_id = (SELECT id FROM taxonomy_level2 WHERE slug = 'yoga_achtsamkeit' LIMIT 1)
-- ORDER BY sort_order, id;
