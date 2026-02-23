-- ============================================
-- Migration: Add delete_provider_account function
-- ============================================
-- This function safely deletes all data associated with a provider account.
-- It handles all related tables in the correct order to respect foreign key constraints.
--
-- Tables affected:
-- 1. course_category_assignments (via courses)
-- 2. ticket_periods (via courses)
-- 3. bookings (via course_events)
-- 4. course_events (via courses)
-- 5. courses (via user_id)
-- 6. provider_slug_aliases (via provider_id)
-- 7. profiles (the main profile)
-- ============================================

CREATE OR REPLACE FUNCTION delete_provider_account(provider_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    course_ids BIGINT[];
    event_ids UUID[];
BEGIN
    -- Verify the caller is the owner of this account
    IF auth.uid() != provider_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
    END IF;

    -- Get all course IDs for this provider
    SELECT array_agg(id) INTO course_ids
    FROM courses
    WHERE user_id = provider_id;

    -- If provider has courses, delete related data
    IF course_ids IS NOT NULL AND array_length(course_ids, 1) > 0 THEN
        -- Delete course_category_assignments
        DELETE FROM course_category_assignments
        WHERE course_id = ANY(course_ids);

        -- Delete ticket_periods
        DELETE FROM ticket_periods
        WHERE course_id = ANY(course_ids);

        -- Get all event IDs for these courses
        SELECT array_agg(id) INTO event_ids
        FROM course_events
        WHERE course_id = ANY(course_ids);

        -- If there are events, delete related bookings
        IF event_ids IS NOT NULL AND array_length(event_ids, 1) > 0 THEN
            DELETE FROM bookings
            WHERE event_id = ANY(event_ids);
        END IF;

        -- Also delete bookings that reference courses directly (platform_flex type)
        DELETE FROM bookings
        WHERE course_id = ANY(course_ids);

        -- Delete course_events
        DELETE FROM course_events
        WHERE course_id = ANY(course_ids);

        -- Delete courses
        DELETE FROM courses
        WHERE user_id = provider_id;
    END IF;

    -- Delete provider_slug_aliases
    DELETE FROM provider_slug_aliases
    WHERE provider_slug_aliases.provider_id = delete_provider_account.provider_id;

    -- Delete the profile
    DELETE FROM profiles
    WHERE id = provider_id;

    RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_provider_account(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_provider_account(UUID) IS 'Safely deletes all data associated with a provider account, including courses, events, bookings, and the profile itself.';
