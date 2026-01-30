-- RPC function to safely toggle the is_prio status of a course
-- This function ensures the user can only toggle prio on their own courses

CREATE OR REPLACE FUNCTION toggle_course_prio(course_id UUID, new_prio_status BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    course_owner UUID;
    current_user_id UUID;
BEGIN
    -- Get the current authenticated user
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the owner of the course
    SELECT user_id INTO course_owner
    FROM courses
    WHERE id = course_id;

    IF course_owner IS NULL THEN
        RAISE EXCEPTION 'Course not found';
    END IF;

    -- Check if the current user owns this course
    IF course_owner != current_user_id THEN
        RAISE EXCEPTION 'Not authorized to modify this course';
    END IF;

    -- Update the prio status
    UPDATE courses
    SET is_prio = new_prio_status
    WHERE id = course_id AND user_id = current_user_id;

    RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_course_prio(UUID, BOOLEAN) TO authenticated;
