-- =============================================================================
-- KiddyEats migration 001: Raghav's schema requests (docs/schema-requests.md)
-- Written 6 Nov 2026 by Leslie (schema owner). Checked against the live DB the
-- same day: none of these changes exist yet, all 5 stalls already use an
-- allowed cuisine, and the longest order comment is 16 characters.
--
-- WHAT IT DOES (all additive, safe for existing rows, safe to re-run)
--   #1 menu_items.allergens_checked  boolean, default false (fail closed)
--   #2 add_on_allergens table + backfill from add_ons.allergen_id
--   #3 menu_items.ingredients        text[], default '{}'
--   #4 order_items comment <= 200 characters
--   #5 stalls.cuisine limited to Chinese / Malay / Indian / Western / Drinks
--   #6 add_ons.is_available          boolean, default true
--   #7 menu_items.is_fried, is_low_sugar (boolean), health_score (0-100, nullable)
--   +  v_menu_with_photo now also returns the new menu_items columns
--
-- NOT DONE HERE ON PURPOSE
--   Marking dishes 1-30 as allergens_checked and filling ingredients /
--   add-on allergens. Raghav's backend/raghav/db/seed/02_after_schema_update.sql
--   does that, and it should be run right after this file.
--
-- HOW TO RUN
--   Supabase dashboard -> "KiddyEats Team" -> SQL Editor -> New query ->
--   paste this whole file -> Run. All or nothing (BEGIN/COMMIT).
--   Then run Raghav's 02_after_schema_update.sql.
-- =============================================================================

BEGIN;

-- #1 Allergen data has been reviewed by a person -----------------------------
-- A child with allergies only sees a dish when this is true AND none of its
-- allergens (or chosen add-ons' allergens) match. New dishes start false.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergens_checked boolean NOT NULL DEFAULT false;

-- #2 Several allergens per add-on --------------------------------------------
CREATE TABLE IF NOT EXISTS public.add_on_allergens (
  add_on_id   integer NOT NULL REFERENCES public.add_ons(add_on_id) ON DELETE CASCADE,
  allergen_id integer NOT NULL REFERENCES public.allergens(allergen_id),
  PRIMARY KEY (add_on_id, allergen_id)
);
ALTER TABLE public.add_on_allergens ENABLE ROW LEVEL SECURITY;

-- Copy the 33 existing single-allergen tags so nothing is lost.
-- add_ons.allergen_id stays for now because current code still reads it.
INSERT INTO public.add_on_allergens (add_on_id, allergen_id)
SELECT add_on_id, allergen_id FROM public.add_ons WHERE allergen_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- #3 What's inside (rendered as chips) ---------------------------------------
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS ingredients text[] NOT NULL DEFAULT '{}';

-- #4 Comment length ---------------------------------------------------------
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_comment_length_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_comment_length_check
  CHECK (comment IS NULL OR char_length(comment) <= 200);

-- #5 Fixed cuisine values ----------------------------------------------------
ALTER TABLE public.stalls DROP CONSTRAINT IF EXISTS stalls_cuisine_check;
ALTER TABLE public.stalls
  ADD CONSTRAINT stalls_cuisine_check
  CHECK (cuisine IN ('Chinese', 'Malay', 'Indian', 'Western', 'Drinks'));

-- #6 Add-on can run out on its own ------------------------------------------
ALTER TABLE public.add_ons
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- #7 Healthy meter -----------------------------------------------------------
-- health_score: 0 (treat) to 100 (very healthy). NULL = not scored yet, so the
-- UI can hide the meter instead of showing a wrong value.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_fried     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_low_sugar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_score smallint;
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_health_score_check;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_health_score_check
  CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100);

-- View: the old view lists menu_items columns by name, so new columns would not
-- show up. Same columns in the same order, new ones appended at the end.
CREATE OR REPLACE VIEW public.v_menu_with_photo AS
SELECT m.item_id, m.stall_id, m.name, m.description, m.price,
       m.calories, m.protein_g, m.carbs_g, m.fat_g,
       m.is_vegetarian, m.spice_level, m.is_available, m.default_image_url, m.created_at,
       COALESCE(tp.image_url, m.default_image_url) AS display_image_url,
       tp.votes AS top_photo_votes,
       m.allergens_checked, m.ingredients, m.is_fried, m.is_low_sugar, m.health_score
FROM public.menu_items m
LEFT JOIN LATERAL (
  SELECT pp.image_url, pp.votes
  FROM public.v_public_photos pp
  WHERE pp.item_id = m.item_id
  ORDER BY pp.votes DESC, pp.is_verified_diner DESC, pp.uploaded_at DESC
  LIMIT 1
) tp ON true;

-- Self-check: any failure rolls everything back --------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.add_ons ao
             WHERE ao.allergen_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM public.add_on_allergens aa
                               WHERE aa.add_on_id = ao.add_on_id AND aa.allergen_id = ao.allergen_id)) THEN
    RAISE EXCEPTION 'Check failed: an add_ons.allergen_id was not copied to add_on_allergens.';
  END IF;
END $$;

COMMIT;
