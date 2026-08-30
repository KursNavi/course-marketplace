BEGIN;

-- The trigger is not an RPC endpoint. Pin its search path so object lookup is
-- deterministic and the function does not depend on a caller-controlled path.
ALTER FUNCTION public.prevent_uncategorized_course_publish()
  SET search_path = public;

COMMIT;
