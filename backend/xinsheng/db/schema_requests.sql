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
