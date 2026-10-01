-- Removes guest tournaments past their expiry. Child rows go via ON DELETE CASCADE.
-- Runs before the first migration too, so skip quietly when the table does not exist yet.
DO $$
BEGIN
  IF to_regclass('public.tournaments') IS NOT NULL THEN
    DELETE FROM tournaments WHERE expires_at IS NOT NULL AND expires_at < now();
  END IF;
END
$$;
