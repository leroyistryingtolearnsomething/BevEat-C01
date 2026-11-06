-- =============================================================================
-- 03_more_add_ons.sql  (Raghav: food ordering / add-ons)
-- =============================================================================
-- RAGHAV: REVIEW BEFORE RUNNING. Run it yourself in the Supabase SQL Editor.
--
-- WHAT IT DOES
--   1. Gives each of the 19 dishes that have NO add-ons 2-3 realistic add-ons
--      (43 new rows in add_ons). The 11 dishes that already have add-ons are not touched.
--   2. Fixes a safety gap in add-on 12 "Add vanilla ice cream" (Ice Kacang):
--      ice cream has milk AND egg, but only Milk was recorded, and Ice Kacang has no
--      Egg tag. So an egg-allergic child could add egg. See "Step 3" below.
--   3. If Leslie has already created add_on_allergens (schema request #2), it also
--      fills that table with the FULL allergen list for each new add-on.
--
-- THE SAFETY RULE THIS FILE FOLLOWS
--   add_ons.allergen_id holds ONE allergen. So every allergen an add-on contains must be
--   EITHER its allergen_id OR already tagged on the dish itself. Then a child who can
--   see the dish (none of its allergens match) only needs the add-on's one allergen_id
--   checked, and nothing is hidden. Step 1 checks this automatically: the column
--   `also_contains` lists each add-on's other allergens, and the file STOPS if any of
--   them isn't on the dish.
--
-- USES EXISTING TABLES ONLY. No CREATE / ALTER / DROP.
--
-- SAFE TO RE-RUN
--   - An add-on is only inserted if that dish doesn't already have one with the same
--     name (case-insensitive), so a second run inserts 0 rows.
--   - add_on_id comes from the identity sequence (it was at 15 on 2026-11-06), so it
--     can't collide with add-ons 1-15 from 01_stalls_menu.sql.
--   - The add-on 12 UPDATE sets the same value each time.
--   - Everything is inside BEGIN/COMMIT, and every check RAISEs, so it's all or nothing.
--
-- HOW TO RUN
--   Supabase dashboard -> project "KiddyEats Team" -> SQL Editor -> New query ->
--   paste this whole file -> Run. The review query at the end lists every add-on.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. The new add-ons, in a temporary table so they can be checked before inserting.
--    Macros are per add-on (negative = less food, e.g. "Less rice").
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE new_add_ons (
  item_id       integer,
  dish_name     text,      -- must match menu_items.name, so a changed ID can't attach to the wrong dish
  name          text,
  extra_price   numeric,
  calories      integer,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  allergen      text,      -- allergens.name stored in add_ons.allergen_id, or NULL
  also_contains text[]     -- its OTHER allergens: each must already be tagged on the dish
) ON COMMIT DROP;

INSERT INTO new_add_ons VALUES
  -- Lim's Chicken Rice
  (2,  'Roasted Chicken Rice',  'Extra roast chicken',    1.50,  160, 14,   1, 11,  'Soy',            '{Wheat / gluten}'), -- soy-sauce marinade
  (2,  'Roasted Chicken Rice',  'Less rice',              0.00, -100, -2, -22,  0,  NULL,             '{}'),
  (2,  'Roasted Chicken Rice',  'Add hard-boiled egg',    0.80,   75,  6,   1,  5,  'Egg',            '{}'),
  (3,  'Kids Chicken Rice Set', 'Add hard-boiled egg',    0.80,   75,  6,   1,  5,  'Egg',            '{}'),
  (3,  'Kids Chicken Rice Set', 'Extra cucumber',         0.00,    5,  0,   1,  0,  NULL,             '{}'),
  (13, 'Char Siew Rice',        'Extra char siew',        1.50,  150, 12,   8,  8,  'Soy',            '{Wheat / gluten,Sesame}'), -- char siew sauce + sesame oil
  (13, 'Char Siew Rice',        'Add hard-boiled egg',    0.80,   75,  6,   1,  5,  'Egg',            '{}'),
  (13, 'Char Siew Rice',        'Less rice',              0.00, -100, -2, -22,  0,  NULL,             '{}'),
  (14, 'Dry Wanton Noodles',    'Extra wantons (3 pcs)',  1.00,  120,  7,  10,  5,  'Shellfish',      '{Wheat / gluten,Egg}'), -- prawn filling, egg-wheat skin
  (14, 'Dry Wanton Noodles',    'No chilli',              0.00,    0,  0,   0,  0,  NULL,             '{}'),
  (15, 'Fishball Noodle Soup',  'Extra fishballs (4 pcs)',0.80,   80,  7,   6,  2,  'Fish',           '{}'),
  (15, 'Fishball Noodle Soup',  'Less noodles',           0.00,  -80, -3, -16, -1,  NULL,             '{}'),
  -- Mariam Nasi Lemak
  (5,  'Mee Goreng',            'Add fried egg',          0.80,   90,  6,   0,  7,  'Egg',            '{}'),
  (5,  'Mee Goreng',            'Less spicy',             0.00,    0,  0,   0,  0,  NULL,             '{}'),
  (6,  'Plain Nasi Lemak (no sambal)', 'Add fried chicken wing', 1.50, 200, 14, 6, 13, 'Wheat / gluten', '{Egg}'), -- flour + egg batter
  (6,  'Plain Nasi Lemak (no sambal)', 'Add ikan bilis',  0.50,   60,  7,   0,  3,  'Fish',           '{}'),
  (6,  'Plain Nasi Lemak (no sambal)', 'Add sambal',      0.30,   40,  0,   3,  3,  'Shellfish',      '{}'), -- belacan (shrimp paste)
  (16, 'Mee Soto',              'Add begedil',            0.80,  120,  2,  14,  6,  'Egg',            '{}'), -- potato patty dipped in egg
  (16, 'Mee Soto',              'Extra chicken',          1.00,  100, 12,   0,  5,  NULL,             '{}'),
  (18, 'Mee Rebus',             'Extra egg',              0.50,   70,  6,   0,  5,  'Egg',            '{}'),
  (18, 'Mee Rebus',             'Add tau kwa',            0.50,   80,  8,   2,  5,  'Soy',            '{}'), -- firm tofu
  -- Kumar's Prata Corner
  (9,  'Cheese Prata with Dhal (2 pcs)', 'Extra dhal',    0.50,   60,  3,   7,  2,  'Milk',           '{}'), -- ghee
  (9,  'Cheese Prata with Dhal (2 pcs)', 'Add egg inside',0.50,   70,  6,   0,  5,  'Egg',            '{}'),
  (20, 'Plain Thosai with Dhal','Make it egg thosai',     0.70,   70,  6,   0,  5,  'Egg',            '{}'),
  (20, 'Plain Thosai with Dhal','Extra dhal',             0.50,   60,  3,   7,  2,  'Milk',           '{}'), -- ghee
  (20, 'Plain Thosai with Dhal','Add onion',              0.30,   15,  0,   3,  0,  NULL,             '{}'),
  (21, 'Roti John',             'Add cheese',             0.80,   80,  5,   0,6.5,  'Milk',           '{}'),
  (21, 'Roti John',             'Less chilli sauce',      0.00,  -10,  0,  -2,  0,  NULL,             '{}'),
  -- Wong's Drinks & Desserts
  (12, 'Fresh Watermelon Juice','Less ice',               0.00,    0,  0,   0,  0,  NULL,             '{}'),
  (12, 'Fresh Watermelon Juice','Large cup',              0.80,   55,  1,  13,  0,  NULL,             '{}'),
  (22, 'Soya Bean Milk',        'Less sweet',             0.00,  -30,  0,  -8,  0,  NULL,             '{}'),
  (22, 'Soya Bean Milk',        'Add grass jelly',        0.50,   30,  0,   7,  0,  NULL,             '{}'),
  (23, 'Barley Water',          'Less sweet',             0.00,  -30,  0,  -8,  0,  NULL,             '{}'),
  (23, 'Barley Water',          'Less ice',               0.00,    0,  0,   0,  0,  NULL,             '{}'),
  -- Hakim's Western Grill
  (26, 'Fish & Chips',          'Extra fries',            1.00,  160,  2,  20,  8,  NULL,             '{}'),
  (26, 'Fish & Chips',          'Extra tartar sauce',     0.30,   70,  0,   1,  7,  'Egg',            '{}'), -- mayonnaise
  (28, 'Chicken Nuggets & Fries','3 more nuggets',        1.20,  150,  8,   9,  9,  'Wheat / gluten', '{Egg,Soy}'), -- breaded
  (28, 'Chicken Nuggets & Fries','Extra fries',           1.00,  160,  2,  20,  8,  NULL,             '{}'),
  (29, 'Grilled Chicken with Mashed Potato', 'Extra mashed potato', 0.80, 110, 2, 15, 5, 'Milk',      '{}'), -- butter + milk
  (29, 'Grilled Chicken with Mashed Potato', 'Add fried egg',       0.80,  90, 6,  0, 7, 'Egg',       '{}'),
  (29, 'Grilled Chicken with Mashed Potato', 'Extra veggies',       0.50,  30, 1,  6, 0, NULL,        '{}'),
  (30, 'Mac & Cheese',          'Extra cheese',           0.80,   80,  5,   0,6.5,  'Milk',           '{}'),
  (30, 'Mac & Cheese',          'Add broccoli',           0.50,   25,  2,   4,  0,  NULL,             '{}');

-- -----------------------------------------------------------------------------
-- 2. Checks. Any problem stops the whole file and nothing is changed.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  bad text;
BEGIN
  -- 2a. Each item_id is the dish we think it is
  SELECT string_agg(DISTINCT n.item_id || ' (' || n.dish_name || ')', ', ') INTO bad
  FROM new_add_ons n
  LEFT JOIN public.menu_items m ON m.item_id = n.item_id AND m.name = n.dish_name
  WHERE m.item_id IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'These dishes are missing or renamed: %. Run 01_stalls_menu.sql first, or fix this file.', bad;
  END IF;

  -- 2b. Every allergen name exists in the allergens table
  SELECT string_agg(DISTINCT a.name, ', ') INTO bad
  FROM (SELECT allergen AS name FROM new_add_ons WHERE allergen IS NOT NULL
        UNION SELECT unnest(also_contains) FROM new_add_ons) a
  LEFT JOIN public.allergens al ON al.name = a.name
  WHERE al.allergen_id IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown allergen name(s): %', bad;
  END IF;

  -- 2c. THE SAFETY RULE: every "also_contains" allergen is already tagged on the dish.
  --     Otherwise a child who can see the dish could add an allergen we never recorded.
  SELECT string_agg(n.name || ' on item ' || n.item_id || ' also has ' || x.allergen, '; ') INTO bad
  FROM new_add_ons n
  CROSS JOIN LATERAL unnest(n.also_contains) AS x(allergen)
  JOIN public.allergens al ON al.name = x.allergen
  WHERE NOT EXISTS (SELECT 1 FROM public.menu_item_allergens mia
                    WHERE mia.item_id = n.item_id AND mia.allergen_id = al.allergen_id);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Safety rule broken (hidden allergen): %', bad;
  END IF;

  -- 2d. 1-3 add-ons per dish once this file has run (existing + new)
  SELECT string_agg(item_id || ' has ' || total, ', ') INTO bad
  FROM (
    SELECT m.item_id,
           (SELECT COUNT(*) FROM public.add_ons a WHERE a.item_id = m.item_id)
         + (SELECT COUNT(*) FROM new_add_ons n WHERE n.item_id = m.item_id
              AND NOT EXISTS (SELECT 1 FROM public.add_ons a
                              WHERE a.item_id = n.item_id AND lower(a.name) = lower(n.name))) AS total
    FROM public.menu_items m
    WHERE m.item_id BETWEEN 1 AND 30
  ) t
  WHERE total NOT BETWEEN 1 AND 3;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Each dish should end up with 1-3 add-ons, but: %', bad;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Insert the new add-ons (skips any the dish already has, so re-runs add nothing)
-- -----------------------------------------------------------------------------
INSERT INTO public.add_ons (item_id, name, extra_price, calories, protein_g, carbs_g, fat_g, allergen_id)
SELECT n.item_id, n.name, n.extra_price, n.calories, n.protein_g, n.carbs_g, n.fat_g, al.allergen_id
FROM new_add_ons n
LEFT JOIN public.allergens al ON al.name = n.allergen
WHERE NOT EXISTS (SELECT 1 FROM public.add_ons a
                  WHERE a.item_id = n.item_id AND lower(a.name) = lower(n.name));

-- -----------------------------------------------------------------------------
-- 4. Fix add-on 12 "Add vanilla ice cream" on Ice Kacang (item 24).
--    Ice cream = milk + egg. Ice Kacang is already tagged Milk (and Peanuts), so a
--    milk-allergic child never sees the dish. The allergen that is NEW to the dish is Egg,
--    so with only one allergen_id slot, Egg is the value that keeps every child safe.
--    02_after_schema_update.sql records both (milk + egg) once add_on_allergens exists.
-- -----------------------------------------------------------------------------
UPDATE public.add_ons
SET allergen_id = (SELECT allergen_id FROM public.allergens WHERE name = 'Egg')
WHERE add_on_id = 12 AND item_id = 24 AND name = 'Add vanilla ice cream';

-- -----------------------------------------------------------------------------
-- 5. Only if Leslie has created add_on_allergens (schema request #2): record the FULL
--    allergen list of every new add-on there too. Dynamic SQL so this file still runs
--    before the table exists. No user input is involved.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.add_on_allergens') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.add_on_allergens (add_on_id, allergen_id)
      SELECT a.add_on_id, al.allergen_id
      FROM new_add_ons n
      JOIN public.add_ons a ON a.item_id = n.item_id AND lower(a.name) = lower(n.name)
      CROSS JOIN LATERAL unnest(array_remove(n.also_contains || n.allergen, NULL)) AS x(allergen)
      JOIN public.allergens al ON al.name = x.allergen
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Review: every dish with its allergens and add-ons (run after COMMIT)
-- -----------------------------------------------------------------------------
SELECT m.item_id,
       m.name AS dish,
       (SELECT string_agg(al.name, ', ' ORDER BY al.allergen_id)
          FROM public.menu_item_allergens mia JOIN public.allergens al USING (allergen_id)
         WHERE mia.item_id = m.item_id) AS dish_allergens,
       a.add_on_id,
       a.name AS add_on,
       a.extra_price,
       a.calories, a.protein_g, a.carbs_g, a.fat_g,
       al.name AS add_on_allergen
FROM public.menu_items m
LEFT JOIN public.add_ons a   ON a.item_id = m.item_id
LEFT JOIN public.allergens al ON al.allergen_id = a.allergen_id
ORDER BY m.stall_id, m.item_id, a.add_on_id;
