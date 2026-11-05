-- #############################################################################
-- ##                                                                         ##
-- ##   WARNING: DO NOT RUN THIS FILE YET.                                    ##
-- ##                                                                         ##
-- ##   Run it ONLY after Leslie has applied these requests from              ##
-- ##   docs/schema-requests.md:                                              ##
-- ##     #1  menu_items.allergens_checked  boolean                           ##
-- ##     #2  add_on_allergens table  (add_on_id, allergen_id)                ##
-- ##     #3  menu_items.ingredients  text[]                                  ##
-- ##   and AFTER 01_stalls_menu.sql has run.                                 ##
-- ##                                                                         ##
-- ##   If any of those are missing, the check in step 0 stops the file       ##
-- ##   and nothing is changed. If Leslie made ingredients a plain `text`     ##
-- ##   column instead of text[], this file needs editing first.              ##
-- ##                                                                         ##
-- #############################################################################
--
-- WHAT IT DOES
--   1. Fills menu_items.ingredients for all 30 dishes (items 1-30). Each list
--      explains where every allergen tag in file 1 comes from.
--   2. Sets allergens_checked = true for items 1-30. This means "a person reviewed
--      this dish's allergen list", so a dish with no tags (Fresh Watermelon Juice)
--      can now be shown to children with allergies instead of failing closed.
--   3. Fills add_on_allergens with the FULL allergen list for each add-on, including
--      the ones with 2+ allergens that add_ons.allergen_id can't hold
--      (3 braised egg, 4 drumstick, 5 otah, 12 ice cream).
--      add_ons.allergen_id is left as-is because the current code still reads it.
--
-- SAFE TO RE-RUN: UPDATEs by ID, and add_on_allergens rows for add-ons 1-15 are deleted
-- and re-inserted. All-or-nothing (BEGIN/COMMIT, and the checks RAISE on any problem).
--
-- HOW TO RUN (only when the columns above exist)
--   Supabase dashboard -> project "KiddyEats Team" -> SQL Editor -> New query ->
--   paste this whole file -> Run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Stop early with a clear message if the schema change hasn't been applied.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'allergens_checked') THEN
    RAISE EXCEPTION 'menu_items.allergens_checked does not exist yet. Ask Leslie to apply schema request #1 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'ingredients'
                   AND data_type = 'ARRAY') THEN
    RAISE EXCEPTION 'menu_items.ingredients (text[]) does not exist yet. Ask Leslie to apply schema request #3 first.';
  END IF;
  IF to_regclass('public.add_on_allergens') IS NULL THEN
    RAISE EXCEPTION 'Table add_on_allergens does not exist yet. Ask Leslie to apply schema request #2 first.';
  END IF;
  IF (SELECT COUNT(*) FROM public.menu_items WHERE item_id BETWEEN 1 AND 30) <> 30 THEN
    RAISE EXCEPTION 'Items 1-30 are not all there. Run 01_stalls_menu.sql first.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Ingredients (simple words so they display well as chips in the UI)
-- -----------------------------------------------------------------------------
UPDATE public.menu_items m
SET ingredients = v.ingredients
FROM (VALUES
  -- Stall 1: Lim's Chicken Rice
  (1,  ARRAY['steamed chicken','chicken rice','garlic','ginger','pandan leaf','cucumber','light soy sauce','sesame oil','chilli sauce (side)']),
  (2,  ARRAY['roast chicken','chicken rice','garlic','ginger','cucumber','light soy sauce','dark soy sauce','sesame oil','chilli sauce (side)']),
  (3,  ARRAY['steamed chicken','chicken rice','cucumber','light soy sauce','sesame oil','chicken soup','cabbage']),
  (13, ARRAY['char siew (BBQ pork)','rice','cucumber','char siew sauce (soy sauce, hoisin)','sesame oil','honey']),
  (14, ARRAY['egg noodles','pork & prawn wanton','char siew','chye sim','soy sauce','oyster sauce','sesame oil','chilli (optional)']),
  (15, ARRAY['fishballs','fishcake','mee kia (egg noodles)','chye sim','fish & anchovy soup','light soy sauce','fried shallots']),
  -- Stall 2: Mariam Nasi Lemak
  (4,  ARRAY['coconut rice','fried chicken wing (flour coating)','fried egg','ikan bilis (anchovies)','peanuts','cucumber','sambal (chilli, belacan shrimp paste)']),
  (5,  ARRAY['yellow noodles','egg','small prawns','cabbage','bean sprouts','tomato','kicap manis (sweet soy sauce)','sambal (belacan)','tomato ketchup']),
  (6,  ARRAY['coconut rice','fried egg','cucumber','pandan leaf']),
  (16, ARRAY['yellow noodles','spiced chicken broth','shredded chicken','bean sprouts','fried shallots','sambal kicap (soy sauce, chilli)']),
  (17, ARRAY['fried chicken drumstick (flour & egg coating)','white rice','cucumber','tomato ketchup (side)']),
  (18, ARRAY['yellow noodles','sweet potato gravy','dried shrimp','taucheo (fermented soybean)','ground peanuts','hard-boiled egg','fried tofu','bean sprouts','lime','fried shallots']),
  -- Stall 3: Kumar's Prata Corner
  (7,  ARRAY['prata (wheat flour, ghee)','dhal (lentils, ghee, mild spices)']),
  (8,  ARRAY['prata (wheat flour, ghee)','egg','onion','dhal (lentils, ghee, mild spices)']),
  (9,  ARRAY['prata (wheat flour, ghee)','cheese','dhal (lentils, ghee, mild spices)']),
  (19, ARRAY['basmati rice','chicken','yoghurt','ghee','fried onions','cashew nuts','raisins','spices','cucumber']),
  (20, ARRAY['thosai (rice & urad dal batter)','ghee','dhal (lentils, ghee, mild spices)','coconut chutney']),
  (21, ARRAY['French loaf','egg','minced chicken','onion','butter','mayonnaise','chilli sauce','tomato ketchup']),
  -- Stall 4: Wong's Drinks & Desserts
  (10, ARRAY['Milo powder (malted barley, milk solids, cocoa, soy lecithin)','evaporated milk','sugar','ice']),
  (11, ARRAY['shaved ice','coconut milk','gula melaka (palm sugar)','pandan jelly','red beans']),
  (12, ARRAY['watermelon','ice']),
  (22, ARRAY['soya beans','water','sugar','pandan leaf']),
  (23, ARRAY['pearl barley','water','rock sugar','pandan leaf']),
  (24, ARRAY['shaved ice','red beans','sweet corn','attap seeds','grass jelly','rose syrup','evaporated milk','condensed milk','crushed peanuts']),
  -- Stall 5: Hakim's Western Grill
  (25, ARRAY['chicken thigh','mushroom sauce (butter, cream, flour, mushrooms)','fries','coleslaw (cabbage, carrot, mayonnaise)','baked beans']),
  (26, ARRAY['dory fish fillet','batter (flour, egg)','fries','coleslaw (mayonnaise)','tartar sauce (mayonnaise)','lemon']),
  (27, ARRAY['spaghetti (wheat)','minced beef','tomato sauce','onion','parmesan cheese']),
  (28, ARRAY['chicken nuggets (chicken, wheat flour coating, egg, soy protein)','fries','tomato ketchup']),
  (29, ARRAY['grilled chicken breast','mashed potato (butter, milk)','brown gravy (flour, soy sauce)','carrot','broccoli']),
  (30, ARRAY['macaroni (wheat)','cheese sauce (cheese, milk, butter, flour)'])
) AS v(item_id, ingredients)
WHERE m.item_id = v.item_id;

-- -----------------------------------------------------------------------------
-- 2. Mark items 1-30 as reviewed. Only seeded dishes are marked: any dish added
--    later stays false (fail closed) until someone reviews its allergens.
-- -----------------------------------------------------------------------------
UPDATE public.menu_items SET allergens_checked = true WHERE item_id BETWEEN 1 AND 30;

-- -----------------------------------------------------------------------------
-- 3. Full allergen list per add-on. Add-ons 1, 2, 6, 8, 9 and 13 have none (no rows).
-- -----------------------------------------------------------------------------
DELETE FROM public.add_on_allergens WHERE add_on_id BETWEEN 1 AND 15;

INSERT INTO public.add_on_allergens (add_on_id, allergen_id)
SELECT tag.add_on_id, a.allergen_id
FROM (VALUES
  (3,'Egg'),(3,'Soy'),(3,'Wheat / gluten'),       -- braised egg: braised in soy sauce
  (4,'Wheat / gluten'),(4,'Egg'),                 -- extra drumstick: flour + egg coating
  (5,'Fish'),(5,'Egg'),(5,'Shellfish'),           -- otah: fish paste, egg, belacan in the rempah
  (7,'Milk'),                                     -- extra dhal: ghee
  (10,'Milk'),                                    -- add cheese
  (11,'Egg'),                                     -- hard-boiled egg
  (12,'Milk'),(12,'Egg'),                         -- vanilla ice cream
  (14,'Egg'),                                     -- fried egg
  (15,'Milk')                                     -- extra cheese
) AS tag(add_on_id, allergen_name)
JOIN public.allergens a ON a.name = tag.allergen_name;

-- -----------------------------------------------------------------------------
-- 4. Self-checks. Any RAISE rolls back the whole file.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  addon_tag_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.menu_items
             WHERE item_id BETWEEN 1 AND 30
               AND (ingredients IS NULL OR cardinality(ingredients) = 0 OR allergens_checked IS NOT TRUE)) THEN
    RAISE EXCEPTION 'Check failed: a dish 1-30 is missing ingredients or is not marked allergens_checked.';
  END IF;

  -- 15 rows are listed above. Fewer means an allergen name didn't match.
  SELECT COUNT(*) INTO addon_tag_count FROM public.add_on_allergens WHERE add_on_id BETWEEN 1 AND 15;
  IF addon_tag_count <> 15 THEN
    RAISE EXCEPTION 'Check failed: expected 15 add-on allergen rows, found %.', addon_tag_count;
  END IF;

  -- The new table must include everything the old single column says (no allergen lost in the move).
  IF EXISTS (
    SELECT 1 FROM public.add_ons ao
    WHERE ao.allergen_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.add_on_allergens aa
                      WHERE aa.add_on_id = ao.add_on_id AND aa.allergen_id = ao.allergen_id)
  ) THEN
    RAISE EXCEPTION 'Check failed: an add_ons.allergen_id is missing from add_on_allergens.';
  END IF;
END $$;

COMMIT;
