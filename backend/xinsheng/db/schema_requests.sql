-- Schema changes for Xin Sheng's features (Leslie please run these in Supabase)
-- all additive, existing rows are fine

-- pickup code, set when the stall marks the order ready
ALTER TABLE public.orders
  ADD COLUMN pickup_code text CHECK (pickup_code ~ '^[0-9]{4}$');

-- PIN lockout after 5 wrong tries
ALTER TABLE public.users
  ADD COLUMN failed_pin_tries smallint NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz;

-- different daily limit on some weekdays (0 = Sunday ... 6 = Saturday)
-- days with no row use child_profiles.daily_limit
CREATE TABLE public.child_day_limits (
  child_id    integer NOT NULL REFERENCES public.child_profiles(child_id) ON DELETE CASCADE,
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  daily_limit numeric(6,2) NOT NULL CHECK (daily_limit BETWEEN 1 AND 50),
  PRIMARY KEY (child_id, weekday)
);
ALTER TABLE public.child_day_limits ENABLE ROW LEVEL SECURITY;

-- added 8 Nov: limit history, so the spending report shows the limit a past day really had
-- a snapshot of the kid's limits is saved every time daily_limit or a weekday limit changes
CREATE TABLE public.child_limit_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id    integer NOT NULL REFERENCES public.child_profiles(child_id) ON DELETE CASCADE,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  daily_limit numeric(6,2) NOT NULL,
  day_limits  jsonb NOT NULL DEFAULT '{}'  -- { "1": 6.00 } weekday -> limit
);
CREATE INDEX child_limit_history_child ON public.child_limit_history (child_id, changed_at);
ALTER TABLE public.child_limit_history ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.save_child_limits(cid integer) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.child_limit_history (child_id, daily_limit, day_limits)
  SELECT c.child_id, c.daily_limit,
         COALESCE((SELECT jsonb_object_agg(d.weekday, d.daily_limit) FROM public.child_day_limits d
                    WHERE d.child_id = c.child_id), '{}')
    FROM public.child_profiles c WHERE c.child_id = cid;
$$;

CREATE FUNCTION public.child_limits_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.save_child_limits(CASE WHEN TG_OP = 'DELETE' THEN OLD.child_id ELSE NEW.child_id END);
  RETURN NULL;
END $$;

CREATE TRIGGER child_profiles_limit_history
  AFTER INSERT OR UPDATE OF daily_limit ON public.child_profiles
  FOR EACH ROW EXECUTE FUNCTION public.child_limits_changed();

CREATE TRIGGER child_day_limits_history
  AFTER INSERT OR UPDATE OR DELETE ON public.child_day_limits
  FOR EACH ROW EXECUTE FUNCTION public.child_limits_changed();

-- starting point for kids that already exist
INSERT INTO public.child_limit_history (child_id, daily_limit, day_limits)
SELECT c.child_id, c.daily_limit,
       COALESCE((SELECT jsonb_object_agg(d.weekday, d.daily_limit) FROM public.child_day_limits d
                  WHERE d.child_id = c.child_id), '{}')
  FROM public.child_profiles c;
