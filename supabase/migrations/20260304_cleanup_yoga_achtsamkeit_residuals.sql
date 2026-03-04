-- ============================================
-- Migration: Yoga & Achtsamkeit residual cleanup
-- Date: 2026-03-04
-- ============================================

DO $$
DECLARE
    v_level2_yoga_id INT;
    v_l3_meditation_id INT;
    v_l4_mbsr_id INT;

    v_l3_persoenlichkeit_id INT;
    v_l4_kausaltraining_id INT;
BEGIN
    SELECT id INTO v_level2_yoga_id
    FROM taxonomy_level2
    WHERE slug = 'yoga_achtsamkeit'
    LIMIT 1;

    IF v_level2_yoga_id IS NULL THEN
        RAISE EXCEPTION 'taxonomy_level2 slug="yoga_achtsamkeit" not found';
    END IF;

    SELECT id INTO v_l3_meditation_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id
      AND slug = 'meditation_achtsamkeit'
    LIMIT 1;

    IF v_l3_meditation_id IS NULL THEN
        RAISE EXCEPTION 'taxonomy_level3 slug="meditation_achtsamkeit" not found under yoga_achtsamkeit';
    END IF;

    SELECT id INTO v_l4_mbsr_id
    FROM taxonomy_level4
    WHERE level3_id = v_l3_meditation_id
      AND slug = 'achtsamkeitstraining_mbsr_alltag'
    LIMIT 1;

    IF v_l4_mbsr_id IS NULL THEN
        RAISE EXCEPTION 'taxonomy_level4 slug="achtsamkeitstraining_mbsr_alltag" not found';
    END IF;

    -- Move residual personality/causal assignments into Meditation & Achtsamkeit -> MBSR/Alltag
    SELECT id INTO v_l3_persoenlichkeit_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id
      AND slug IN ('persoenlichkeitsentwicklung', 'persoenlichkeit')
    ORDER BY id
    LIMIT 1;

    SELECT l4.id INTO v_l4_kausaltraining_id
    FROM taxonomy_level4 l4
    JOIN taxonomy_level3 l3 ON l3.id = l4.level3_id
    WHERE l3.level2_id = v_level2_yoga_id
      AND l4.slug = 'kausaltraining'
    ORDER BY l4.id
    LIMIT 1;

    IF v_l3_persoenlichkeit_id IS NOT NULL OR v_l4_kausaltraining_id IS NOT NULL THEN
        UPDATE course_category_assignments
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_mbsr_id
        WHERE (v_l3_persoenlichkeit_id IS NOT NULL AND level3_id = v_l3_persoenlichkeit_id)
           OR (v_l4_kausaltraining_id IS NOT NULL AND level4_id = v_l4_kausaltraining_id);
    END IF;

    -- Deactivate obsolete Level 3 nodes under Yoga & Achtsamkeit
    UPDATE taxonomy_level3
    SET is_active = false,
        updated_at = NOW()
    WHERE level2_id = v_level2_yoga_id
      AND slug IN ('mental_health', 'persoenlichkeitsentwicklung', 'persoenlichkeit', 'koerperarbeit', 'mental_meditation');

    -- Deactivate obsolete Level 4 legacy nodes under Yoga & Achtsamkeit
    UPDATE taxonomy_level4 l4
    SET is_active = false,
        updated_at = NOW()
    FROM taxonomy_level3 l3
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
          OR (l4.slug = 'massage_wellness' AND l3.slug IN ('koerperarbeit', 'somatics_koerperbewusstsein'))
      );

    -- Resolve potential duplicates after remap
    DELETE FROM course_category_assignments d
    USING (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY course_id, level3_id, COALESCE(level4_id, 0)
                   ORDER BY is_primary DESC, created_at ASC, id ASC
               ) AS rn
        FROM course_category_assignments
    ) x
    WHERE d.id = x.id
      AND x.rn > 1;

    -- Ensure one primary assignment per course
    WITH ranked AS (
        SELECT
            id,
            course_id,
            ROW_NUMBER() OVER (
                PARTITION BY course_id
                ORDER BY is_primary DESC, created_at ASC, id ASC
            ) AS rn
        FROM course_category_assignments
    )
    UPDATE course_category_assignments cca
    SET is_primary = (ranked.rn = 1)
    FROM ranked
    WHERE cca.id = ranked.id;

    -- Sync primary fields on courses
    UPDATE courses c
    SET category_level3_id = primary_cca.level3_id,
        category_level4_id = primary_cca.level4_id
    FROM (
        SELECT course_id, level3_id, level4_id
        FROM course_category_assignments
        WHERE is_primary = true
    ) primary_cca
    WHERE c.id = primary_cca.course_id;

    BEGIN
        PERFORM refresh_taxonomy_paths_manual();
    EXCEPTION
        WHEN undefined_function THEN
            REFRESH MATERIALIZED VIEW v_taxonomy_paths;
    END;
END $$;
