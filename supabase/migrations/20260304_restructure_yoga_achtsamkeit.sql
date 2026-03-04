-- ============================================
-- Migration: Restructure "Yoga & Achtsamkeit" taxonomy
-- Date: 2026-03-04
-- ============================================
-- Goal:
-- - Remove implicit 5th level ("Spezialformen")
-- - Keep a 4-level taxonomy only
-- - Move specialty forms directly to Level 4 under "Yoga"
-- - Reorganize existing course assignments into the new structure
-- ============================================

DO $$
DECLARE
    v_level2_yoga_id INT;

    v_l3_yoga_id INT;
    v_l3_meditation_id INT;
    v_l3_energie_id INT;
    v_l3_somatics_id INT;
    v_l3_mental_health_id INT;
    v_l3_atemarbeit_id INT;
    v_l3_klang_mantra_id INT;
    v_l3_bodywork_id INT;

    -- Legacy level4 IDs/slugs
    v_old_l4_hatha_flow_id INT;
    v_old_l4_wasser_id INT;
    v_old_l4_yoga_nidra_id INT;
    v_old_l4_meditation_id INT;
    v_old_l4_klang_atemreise_id INT;
    v_old_l4_reiki_chakra_id INT;
    v_old_l4_feldenkrais_pilates_id INT;
    v_old_l4_massage_wellness_id INT;
    v_old_l4_resilienz_id INT;

    -- New level4 IDs
    v_l4_hatha_id INT;
    v_l4_vinyasa_id INT;
    v_l4_yin_id INT;
    v_l4_power_id INT;
    v_l4_kundalini_id INT;
    v_l4_alignment_id INT;
    v_l4_thera_id INT;
    v_l4_wasser_sup_id INT;
    v_l4_hot_id INT;
    v_l4_aerial_id INT;

    v_l4_mbsr_id INT;
    v_l4_gefuehrt_id INT;
    v_l4_stille_id INT;
    v_l4_yn_meditation_id INT;
    v_l4_metta_id INT;

    v_l4_pranayama_id INT;
    v_l4_breathwork_id INT;
    v_l4_atemreise_id INT;

    v_l4_soundbath_id INT;
    v_l4_gong_id INT;
    v_l4_mantra_id INT;
    v_l4_klangreise_id INT;
    v_l4_rhythmus_id INT;

    v_l4_feldenkrais_id INT;
    v_l4_pilates_id INT;
    v_l4_embodiment_id INT;
    v_l4_faszien_id INT;
    v_l4_entspannung_id INT;

    v_l4_reiki_id INT;
    v_l4_chakra_id INT;
    v_l4_healing_id INT;

    v_l4_thai_id INT;
    v_l4_bodywork_massage_id INT;
    v_l4_koerpertherapie_id INT;
BEGIN
    -- ============================================
    -- 1) Resolve parent Level 2 node
    -- ============================================
    SELECT id INTO v_level2_yoga_id
    FROM taxonomy_level2
    WHERE slug = 'yoga_achtsamkeit'
    LIMIT 1;

    IF v_level2_yoga_id IS NULL THEN
        RAISE EXCEPTION 'taxonomy_level2 slug="yoga_achtsamkeit" not found';
    END IF;

    -- ============================================
    -- 2) Ensure/rename Level 3 nodes
    -- ============================================

    -- Yoga (existing)
    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'yoga', 'Yoga', 1, true)
    ON CONFLICT (level2_id, slug) DO NOTHING;

    SELECT id INTO v_l3_yoga_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'yoga'
    LIMIT 1;

    -- Meditation & Achtsamkeit (rename legacy "mental_meditation")
    UPDATE taxonomy_level3
    SET slug = 'meditation_achtsamkeit',
        label_de = 'Meditation & Achtsamkeit',
        sort_order = 2,
        is_active = true,
        updated_at = NOW()
    WHERE level2_id = v_level2_yoga_id
      AND slug = 'mental_meditation';

    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'meditation_achtsamkeit', 'Meditation & Achtsamkeit', 2, true)
    ON CONFLICT (level2_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    SELECT id INTO v_l3_meditation_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'meditation_achtsamkeit'
    LIMIT 1;

    -- Atemarbeit (new)
    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'atemarbeit', 'Atemarbeit', 3, true)
    ON CONFLICT (level2_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    SELECT id INTO v_l3_atemarbeit_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'atemarbeit'
    LIMIT 1;

    -- Klang & Mantra (new)
    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'klang_mantra', 'Klang & Mantra', 4, true)
    ON CONFLICT (level2_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    SELECT id INTO v_l3_klang_mantra_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'klang_mantra'
    LIMIT 1;

    -- Somatics & Körperbewusstsein (rename legacy "koerperarbeit")
    UPDATE taxonomy_level3
    SET slug = 'somatics_koerperbewusstsein',
        label_de = 'Somatics & Körperbewusstsein',
        sort_order = 5,
        is_active = true,
        updated_at = NOW()
    WHERE level2_id = v_level2_yoga_id
      AND slug = 'koerperarbeit';

    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'somatics_koerperbewusstsein', 'Somatics & Körperbewusstsein', 5, true)
    ON CONFLICT (level2_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    SELECT id INTO v_l3_somatics_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'somatics_koerperbewusstsein'
    LIMIT 1;

    -- Energiearbeit (existing)
    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'energiearbeit', 'Energiearbeit', 6, true)
    ON CONFLICT (level2_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    SELECT id INTO v_l3_energie_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'energiearbeit'
    LIMIT 1;

    -- Bodywork & Massage (new)
    INSERT INTO taxonomy_level3 (level2_id, slug, label_de, sort_order, is_active)
    VALUES (v_level2_yoga_id, 'bodywork_massage', 'Bodywork & Massage', 7, true)
    ON CONFLICT (level2_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    SELECT id INTO v_l3_bodywork_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'bodywork_massage'
    LIMIT 1;

    -- Legacy "mental_health" may exist; we'll deactivate after reassignment.
    SELECT id INTO v_l3_mental_health_id
    FROM taxonomy_level3
    WHERE level2_id = v_level2_yoga_id AND slug = 'mental_health'
    LIMIT 1;

    -- ============================================
    -- 3) Ensure Level 4 nodes (new target tree)
    -- ============================================

    -- Yoga
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_yoga_id, 'hatha_grundlagen', 'Hatha & Grundlagen', 1, true),
    (v_l3_yoga_id, 'vinyasa_flow', 'Vinyasa & Flow', 2, true),
    (v_l3_yoga_id, 'yin_restorative', 'Yin & Restorative', 3, true),
    (v_l3_yoga_id, 'power_ashtanga', 'Power & Ashtanga', 4, true),
    (v_l3_yoga_id, 'kundalini', 'Kundalini', 5, true),
    (v_l3_yoga_id, 'alignment_iyengar_ausrichtung', 'Alignment (Iyengar & Ausrichtung)', 6, true),
    (v_l3_yoga_id, 'therapeutisches_yoga', 'Therapeutisches Yoga', 7, true),
    (v_l3_yoga_id, 'wasser_sup_yoga', 'Wasser-/SUP-Yoga', 8, true),
    (v_l3_yoga_id, 'hot_yoga', 'Hot Yoga', 9, true),
    (v_l3_yoga_id, 'aerial_acro_chair', 'Aerial / Acro / Chair', 10, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Meditation & Achtsamkeit
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_meditation_id, 'achtsamkeitstraining_mbsr_alltag', 'Achtsamkeitstraining (MBSR/Alltag)', 1, true),
    (v_l3_meditation_id, 'gefuehrte_meditation', 'Geführte Meditation', 2, true),
    (v_l3_meditation_id, 'stille_meditation', 'Stille Meditation', 3, true),
    (v_l3_meditation_id, 'yoga_nidra', 'Yoga Nidra', 4, true),
    (v_l3_meditation_id, 'metta_selbstmitgefuehl', 'Metta / Selbstmitgefühl', 5, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Atemarbeit
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_atemarbeit_id, 'pranayama', 'Pranayama', 1, true),
    (v_l3_atemarbeit_id, 'breathwork', 'Breathwork', 2, true),
    (v_l3_atemarbeit_id, 'atemreise', 'Atemreise', 3, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Klang & Mantra
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_klang_mantra_id, 'klangmeditation_sound_bath', 'Klangmeditation / Sound Bath', 1, true),
    (v_l3_klang_mantra_id, 'gong_klanginstrumente', 'Gong & Klanginstrumente', 2, true),
    (v_l3_klang_mantra_id, 'mantra_kirtan', 'Mantra & Kirtan', 3, true),
    (v_l3_klang_mantra_id, 'klangreise', 'Klangreise', 4, true),
    (v_l3_klang_mantra_id, 'rhythmus_trommeln', 'Rhythmus & Trommeln', 5, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Somatics & Körperbewusstsein
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_somatics_id, 'feldenkrais', 'Feldenkrais', 1, true),
    (v_l3_somatics_id, 'pilates_yoga_pilates', 'Pilates & Yoga-Pilates', 2, true),
    (v_l3_somatics_id, 'embodiment_somatic_movement', 'Embodiment / Somatic Movement', 3, true),
    (v_l3_somatics_id, 'faszien_mobility', 'Faszien & Mobility', 4, true),
    (v_l3_somatics_id, 'entspannungsverfahren_pmr_autogen', 'Entspannungsverfahren (PMR / Autogen)', 5, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Energiearbeit
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_energie_id, 'reiki', 'Reiki', 1, true),
    (v_l3_energie_id, 'chakra_energiezentren', 'Chakra & Energiezentren', 2, true),
    (v_l3_energie_id, 'energieheilung_healing', 'Energieheilung / Healing', 3, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Bodywork & Massage
    INSERT INTO taxonomy_level4 (level3_id, slug, label_de, sort_order, is_active) VALUES
    (v_l3_bodywork_id, 'thai_yoga_massage', 'Thai Yoga Massage', 1, true),
    (v_l3_bodywork_id, 'massage_wellness', 'Massage & Wellness', 2, true),
    (v_l3_bodywork_id, 'koerpertherapie', 'Körpertherapie', 3, true)
    ON CONFLICT (level3_id, slug) DO UPDATE
    SET label_de = EXCLUDED.label_de,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = NOW();

    -- Resolve legacy Level 4 IDs by slug (if present)
    SELECT id INTO v_old_l4_hatha_flow_id FROM taxonomy_level4 WHERE slug = 'hatha_flow_vinyasa' LIMIT 1;
    SELECT id INTO v_old_l4_wasser_id FROM taxonomy_level4 WHERE slug = 'wasser_yoga' LIMIT 1;
    SELECT id INTO v_old_l4_yoga_nidra_id FROM taxonomy_level4 WHERE slug = 'yoga_nidra' AND level3_id = v_l3_yoga_id LIMIT 1;
    SELECT id INTO v_old_l4_meditation_id FROM taxonomy_level4 WHERE slug = 'meditation_achtsamkeit' LIMIT 1;
    SELECT id INTO v_old_l4_klang_atemreise_id FROM taxonomy_level4 WHERE slug = 'klang_atemreise' LIMIT 1;
    SELECT id INTO v_old_l4_reiki_chakra_id FROM taxonomy_level4 WHERE slug = 'reiki_chakra' LIMIT 1;
    SELECT id INTO v_old_l4_feldenkrais_pilates_id FROM taxonomy_level4 WHERE slug = 'feldenkrais_pilates' LIMIT 1;
    SELECT id INTO v_old_l4_massage_wellness_id FROM taxonomy_level4 WHERE slug = 'massage_wellness' AND level3_id = v_l3_somatics_id LIMIT 1;
    SELECT id INTO v_old_l4_resilienz_id FROM taxonomy_level4 WHERE slug = 'resilienz_coaching' LIMIT 1;

    -- Resolve new Level 4 IDs by slug
    SELECT id INTO v_l4_hatha_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'hatha_grundlagen';
    SELECT id INTO v_l4_vinyasa_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'vinyasa_flow';
    SELECT id INTO v_l4_yin_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'yin_restorative';
    SELECT id INTO v_l4_power_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'power_ashtanga';
    SELECT id INTO v_l4_kundalini_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'kundalini';
    SELECT id INTO v_l4_alignment_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'alignment_iyengar_ausrichtung';
    SELECT id INTO v_l4_thera_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'therapeutisches_yoga';
    SELECT id INTO v_l4_wasser_sup_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'wasser_sup_yoga';
    SELECT id INTO v_l4_hot_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'hot_yoga';
    SELECT id INTO v_l4_aerial_id FROM taxonomy_level4 WHERE level3_id = v_l3_yoga_id AND slug = 'aerial_acro_chair';

    SELECT id INTO v_l4_mbsr_id FROM taxonomy_level4 WHERE level3_id = v_l3_meditation_id AND slug = 'achtsamkeitstraining_mbsr_alltag';
    SELECT id INTO v_l4_gefuehrt_id FROM taxonomy_level4 WHERE level3_id = v_l3_meditation_id AND slug = 'gefuehrte_meditation';
    SELECT id INTO v_l4_stille_id FROM taxonomy_level4 WHERE level3_id = v_l3_meditation_id AND slug = 'stille_meditation';
    SELECT id INTO v_l4_yn_meditation_id FROM taxonomy_level4 WHERE level3_id = v_l3_meditation_id AND slug = 'yoga_nidra';
    SELECT id INTO v_l4_metta_id FROM taxonomy_level4 WHERE level3_id = v_l3_meditation_id AND slug = 'metta_selbstmitgefuehl';

    SELECT id INTO v_l4_pranayama_id FROM taxonomy_level4 WHERE level3_id = v_l3_atemarbeit_id AND slug = 'pranayama';
    SELECT id INTO v_l4_breathwork_id FROM taxonomy_level4 WHERE level3_id = v_l3_atemarbeit_id AND slug = 'breathwork';
    SELECT id INTO v_l4_atemreise_id FROM taxonomy_level4 WHERE level3_id = v_l3_atemarbeit_id AND slug = 'atemreise';

    SELECT id INTO v_l4_soundbath_id FROM taxonomy_level4 WHERE level3_id = v_l3_klang_mantra_id AND slug = 'klangmeditation_sound_bath';
    SELECT id INTO v_l4_gong_id FROM taxonomy_level4 WHERE level3_id = v_l3_klang_mantra_id AND slug = 'gong_klanginstrumente';
    SELECT id INTO v_l4_mantra_id FROM taxonomy_level4 WHERE level3_id = v_l3_klang_mantra_id AND slug = 'mantra_kirtan';
    SELECT id INTO v_l4_klangreise_id FROM taxonomy_level4 WHERE level3_id = v_l3_klang_mantra_id AND slug = 'klangreise';
    SELECT id INTO v_l4_rhythmus_id FROM taxonomy_level4 WHERE level3_id = v_l3_klang_mantra_id AND slug = 'rhythmus_trommeln';

    SELECT id INTO v_l4_feldenkrais_id FROM taxonomy_level4 WHERE level3_id = v_l3_somatics_id AND slug = 'feldenkrais';
    SELECT id INTO v_l4_pilates_id FROM taxonomy_level4 WHERE level3_id = v_l3_somatics_id AND slug = 'pilates_yoga_pilates';
    SELECT id INTO v_l4_embodiment_id FROM taxonomy_level4 WHERE level3_id = v_l3_somatics_id AND slug = 'embodiment_somatic_movement';
    SELECT id INTO v_l4_faszien_id FROM taxonomy_level4 WHERE level3_id = v_l3_somatics_id AND slug = 'faszien_mobility';
    SELECT id INTO v_l4_entspannung_id FROM taxonomy_level4 WHERE level3_id = v_l3_somatics_id AND slug = 'entspannungsverfahren_pmr_autogen';

    SELECT id INTO v_l4_reiki_id FROM taxonomy_level4 WHERE level3_id = v_l3_energie_id AND slug = 'reiki';
    SELECT id INTO v_l4_chakra_id FROM taxonomy_level4 WHERE level3_id = v_l3_energie_id AND slug = 'chakra_energiezentren';
    SELECT id INTO v_l4_healing_id FROM taxonomy_level4 WHERE level3_id = v_l3_energie_id AND slug = 'energieheilung_healing';

    SELECT id INTO v_l4_thai_id FROM taxonomy_level4 WHERE level3_id = v_l3_bodywork_id AND slug = 'thai_yoga_massage';
    SELECT id INTO v_l4_bodywork_massage_id FROM taxonomy_level4 WHERE level3_id = v_l3_bodywork_id AND slug = 'massage_wellness';
    SELECT id INTO v_l4_koerpertherapie_id FROM taxonomy_level4 WHERE level3_id = v_l3_bodywork_id AND slug = 'koerpertherapie';

    -- ============================================
    -- 4) Re-map existing course assignments
    -- ============================================

    -- 4a) Yoga legacy bucket: hatha_flow_vinyasa -> Hatha vs Vinyasa by keywords
    IF v_old_l4_hatha_flow_id IS NOT NULL THEN
        -- Hatha & Grundlagen
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_yoga_id,
            level4_id = v_l4_hatha_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_hatha_flow_id
          AND (
            COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')
          ) ~* '(hatha|grundlage|grundkurs|einsteiger|anf(a|ä)nger|beginner)';

        -- default -> Vinyasa & Flow
        UPDATE course_category_assignments
        SET level3_id = v_l3_yoga_id,
            level4_id = v_l4_vinyasa_id
        WHERE level4_id = v_old_l4_hatha_flow_id;
    END IF;

    -- 4b) Wasser-Yoga -> Wasser-/SUP-Yoga
    IF v_old_l4_wasser_id IS NOT NULL THEN
        UPDATE course_category_assignments
        SET level3_id = v_l3_yoga_id,
            level4_id = v_l4_wasser_sup_id
        WHERE level4_id = v_old_l4_wasser_id;
    END IF;

    -- 4c) Legacy Yoga Nidra (under Yoga) -> Meditation & Achtsamkeit > Yoga Nidra
    IF v_old_l4_yoga_nidra_id IS NOT NULL THEN
        UPDATE course_category_assignments
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_yn_meditation_id
        WHERE level4_id = v_old_l4_yoga_nidra_id;
    END IF;

    -- 4d) Legacy Meditation & Achtsamkeit split
    IF v_old_l4_meditation_id IS NOT NULL THEN
        -- Stille Meditation
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_stille_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_meditation_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(stille|silent|vipassana|zen|zazen)';

        -- Metta / Selbstmitgefühl
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_metta_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_meditation_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(metta|selbstmitgef(ue|ü)hl|compassion|loving[[:space:]]*kindness)';

        -- Achtsamkeitstraining (MBSR/Alltag)
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_mbsr_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_meditation_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(mbsr|achtsamkeit|mindful|mindfulness|alltag)';

        -- default -> Geführte Meditation
        UPDATE course_category_assignments
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_gefuehrt_id
        WHERE level4_id = v_old_l4_meditation_id;
    END IF;

    -- 4e) Legacy Klang- & Atemreise split into Atemarbeit/Klang & Mantra
    IF v_old_l4_klang_atemreise_id IS NOT NULL THEN
        -- Atemreise if breath-focused
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_atemarbeit_id,
            level4_id = v_l4_atemreise_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_klang_atemreise_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(atem|breath|pranayama)';

        -- default -> Klangreise
        UPDATE course_category_assignments
        SET level3_id = v_l3_klang_mantra_id,
            level4_id = v_l4_klangreise_id
        WHERE level4_id = v_old_l4_klang_atemreise_id;
    END IF;

    -- 4f) Legacy Reiki & Chakra split
    IF v_old_l4_reiki_chakra_id IS NOT NULL THEN
        -- Chakra & Energiezentren
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_energie_id,
            level4_id = v_l4_chakra_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_reiki_chakra_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(chakra|energiezentrum)';

        -- default -> Reiki
        UPDATE course_category_assignments
        SET level3_id = v_l3_energie_id,
            level4_id = v_l4_reiki_id
        WHERE level4_id = v_old_l4_reiki_chakra_id;
    END IF;

    -- 4g) Legacy Feldenkrais & Pilates split
    IF v_old_l4_feldenkrais_pilates_id IS NOT NULL THEN
        -- Pilates
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_somatics_id,
            level4_id = v_l4_pilates_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_feldenkrais_pilates_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(pilates)';

        -- default -> Feldenkrais
        UPDATE course_category_assignments
        SET level3_id = v_l3_somatics_id,
            level4_id = v_l4_feldenkrais_id
        WHERE level4_id = v_old_l4_feldenkrais_pilates_id;
    END IF;

    -- 4h) Legacy Massage & Wellness (from old Körperarbeit) -> Bodywork & Massage
    IF v_old_l4_massage_wellness_id IS NOT NULL THEN
        -- Thai Yoga Massage by keyword
        UPDATE course_category_assignments cca
        SET level3_id = v_l3_bodywork_id,
            level4_id = v_l4_thai_id
        FROM courses c
        WHERE cca.course_id = c.id
          AND cca.level4_id = v_old_l4_massage_wellness_id
          AND (COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) ~* '(thai)';

        -- default -> Massage & Wellness
        UPDATE course_category_assignments
        SET level3_id = v_l3_bodywork_id,
            level4_id = v_l4_bodywork_massage_id
        WHERE level4_id = v_old_l4_massage_wellness_id;
    END IF;

    -- 4i) Legacy Mental Health focus -> Meditation & Achtsamkeit > Achtsamkeitstraining
    IF v_old_l4_resilienz_id IS NOT NULL THEN
        UPDATE course_category_assignments
        SET level3_id = v_l3_meditation_id,
            level4_id = v_l4_mbsr_id
        WHERE level4_id = v_old_l4_resilienz_id;
    END IF;

    -- 4j) Any remaining assignments on legacy level3="mental_health" with NULL level4
    IF v_l3_mental_health_id IS NOT NULL THEN
        UPDATE course_category_assignments
        SET level3_id = v_l3_meditation_id,
            level4_id = COALESCE(level4_id, v_l4_mbsr_id)
        WHERE level3_id = v_l3_mental_health_id;
    END IF;

    -- 4k) Any assignment in Yoga level2 without level4 gets a safe default by level3
    UPDATE course_category_assignments cca
    SET level4_id = CASE
        WHEN cca.level3_id = v_l3_yoga_id THEN v_l4_vinyasa_id
        WHEN cca.level3_id = v_l3_meditation_id THEN v_l4_gefuehrt_id
        WHEN cca.level3_id = v_l3_atemarbeit_id THEN v_l4_atemreise_id
        WHEN cca.level3_id = v_l3_klang_mantra_id THEN v_l4_klangreise_id
        WHEN cca.level3_id = v_l3_somatics_id THEN v_l4_feldenkrais_id
        WHEN cca.level3_id = v_l3_energie_id THEN v_l4_reiki_id
        WHEN cca.level3_id = v_l3_bodywork_id THEN v_l4_bodywork_massage_id
        ELSE cca.level4_id
    END
    FROM taxonomy_level3 l3
    WHERE cca.level4_id IS NULL
      AND l3.id = cca.level3_id
      AND l3.level2_id = v_level2_yoga_id;

    -- 4l) De-duplicate potential collisions (same course/level3/level4 after remap)
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

    -- 4m) Ensure exactly one primary assignment per course where assignments exist
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

    -- 4n) Sync courses primary fields from assignment table
    UPDATE courses c
    SET category_level3_id = primary_cca.level3_id,
        category_level4_id = primary_cca.level4_id
    FROM (
        SELECT course_id, level3_id, level4_id
        FROM course_category_assignments
        WHERE is_primary = true
    ) primary_cca
    WHERE c.id = primary_cca.course_id;

    -- ============================================
    -- 5) Deactivate deprecated legacy nodes
    -- ============================================

    UPDATE taxonomy_level3
    SET is_active = false,
        updated_at = NOW()
    WHERE level2_id = v_level2_yoga_id
      AND slug = 'mental_health';

    UPDATE taxonomy_level4
    SET is_active = false,
        updated_at = NOW()
    WHERE slug IN (
        'hatha_flow_vinyasa',
        'wasser_yoga',
        'meditation_achtsamkeit',
        'klang_atemreise',
        'reiki_chakra',
        'feldenkrais_pilates',
        'resilienz_coaching'
    )
      AND (
        level3_id IN (
            v_l3_yoga_id,
            v_l3_meditation_id,
            v_l3_energie_id,
            v_l3_somatics_id,
            COALESCE(v_l3_mental_health_id, -1)
        )
      );

    -- Deactivate legacy nodes that share slug with new targets
    IF v_old_l4_yoga_nidra_id IS NOT NULL THEN
        UPDATE taxonomy_level4
        SET is_active = false,
            updated_at = NOW()
        WHERE id = v_old_l4_yoga_nidra_id;
    END IF;

    IF v_old_l4_massage_wellness_id IS NOT NULL THEN
        UPDATE taxonomy_level4
        SET is_active = false,
            updated_at = NOW()
        WHERE id = v_old_l4_massage_wellness_id;
    END IF;

    -- Refresh materialized path view (if used anywhere)
    BEGIN
        PERFORM refresh_taxonomy_paths_manual();
    EXCEPTION
        WHEN undefined_function THEN
            REFRESH MATERIALIZED VIEW v_taxonomy_paths;
    END;
END $$;

-- ============================================
-- Verification helpers (manual, optional)
-- ============================================
-- 1) New tree under Yoga & Achtsamkeit
-- SELECT l3.slug AS level3_slug, l3.label_de AS level3_label, l4.slug AS level4_slug, l4.label_de AS level4_label, l4.is_active
-- FROM taxonomy_level3 l3
-- LEFT JOIN taxonomy_level4 l4 ON l4.level3_id = l3.id
-- JOIN taxonomy_level2 l2 ON l2.id = l3.level2_id
-- WHERE l2.slug = 'yoga_achtsamkeit'
-- ORDER BY l3.sort_order, l4.sort_order;
--
-- 2) Course distribution after remap
-- SELECT l3.label_de AS level3_label, l4.label_de AS level4_label, COUNT(*) AS course_count
-- FROM course_category_assignments cca
-- JOIN taxonomy_level3 l3 ON l3.id = cca.level3_id
-- LEFT JOIN taxonomy_level4 l4 ON l4.id = cca.level4_id
-- JOIN taxonomy_level2 l2 ON l2.id = l3.level2_id
-- WHERE l2.slug = 'yoga_achtsamkeit'
-- GROUP BY l3.label_de, l4.label_de
-- ORDER BY l3.label_de, l4.label_de;

