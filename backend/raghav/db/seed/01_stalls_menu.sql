-- =============================================================================
-- 01_stalls_menu.sql  (Raghav: stalls, menu items, allergen tags, add-ons)
-- =============================================================================
-- WHAT IT DOES
--   Resets the demo data for Greenwood Food Centre (centre_id 1) to 5 stalls x 6 dishes:
--     Stall 1 Chinese  : Lim's Chicken Rice          (existing, owner kept)
--     Stall 2 Malay    : Mariam Nasi Lemak (halal)   (existing, owner kept)
--     Stall 3 Indian   : Kumar's Prata Corner (halal)(existing, owner kept)
--     Stall 4 Drinks   : Wong's Drinks & Desserts    (existing, owner kept)
--     Stall 5 Western  : Hakim's Western Grill (halal) NEW, owner_id NULL
--   - Stalls 1-4 are UPDATEd in place. owner_id, unit_no and centre_id are never touched.
--   - Menu items 1-12 are updated in place. Items 1, 3, 4, 9 and 10 stay the SAME dish
--     because orders/photos point at them. New dishes use fixed IDs 13-30 so that the
--     allergen rows and add-ons below can refer to them by ID.
--   - The allergen tags for items 1-30 are replaced with a reviewed list
--     (fixes: item 1-3 missing wheat from soy sauce, item 4 missing shellfish from belacan).
--   - Add-ons 1-9 are updated in place (6 and 8 are unchanged, they are in orders)
--     and 10-15 are added.
--
-- WORKS WITH THE CURRENT SCHEMA. No CREATE / ALTER / DROP. It only uses existing tables/columns.
-- The only DELETE is on menu_item_allergens for items 1-30, so the tags can be rebuilt
-- from the list below. Nothing references that table, so nothing else is affected.
--
-- SAFE TO RE-RUN: stalls/items/add-ons are upserted by fixed ID, and allergen tags are
-- deleted and re-inserted. Running it twice gives the same result.
-- All-or-nothing: wrapped in BEGIN/COMMIT, and the checks at the end RAISE (which rolls
-- everything back) if the data isn't what we expect.
--
-- KNOWN LIMIT (fixed by 02_after_schema_update.sql):
--   add_ons.allergen_id holds ONE allergen. Add-ons 3, 4, 5 and 12 really contain 2-3.
--   Until file 2 runs, only their main allergen is recorded here.
--
-- HOW TO RUN
--   Supabase dashboard -> project "KiddyEats Team" -> SQL Editor -> New query ->
--   paste this whole file -> Run. The review query after COMMIT lists every dish
--   with its allergens so you can check the result.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Guard: stop if a teammate has already used the IDs this script creates.
--    Without this, the upserts below would silently overwrite their rows.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stalls
             WHERE stall_id = 5 AND name <> 'Hakim''s Western Grill') THEN
    RAISE EXCEPTION 'stall_id 5 already exists with a different name. Stopping so it is not overwritten.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.menu_items m
    JOIN (VALUES (13,1),(14,1),(15,1),(16,2),(17,2),(18,2),(19,3),(20,3),(21,3),
                 (22,4),(23,4),(24,4),(25,5),(26,5),(27,5),(28,5),(29,5),(30,5))
         AS expected(item_id, stall_id) ON expected.item_id = m.item_id
    WHERE m.stall_id <> expected.stall_id
  ) THEN
    RAISE EXCEPTION 'A menu item with ID 13-30 already exists under another stall. Stopping so it is not overwritten.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.add_ons a
    JOIN (VALUES (10,8),(11,19),(12,24),(13,25),(14,25),(15,27))
         AS expected(add_on_id, item_id) ON expected.add_on_id = a.add_on_id
    WHERE a.item_id <> expected.item_id
  ) THEN
    RAISE EXCEPTION 'An add-on with ID 10-15 already exists on another dish. Stopping so it is not overwritten.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Stalls
-- -----------------------------------------------------------------------------
-- Stalls 1-4: update in place. owner_id is deliberately left out so it is kept.
UPDATE public.stalls SET
  name = 'Lim''s Chicken Rice', cuisine = 'Chinese', is_halal = false,
  description = 'Chicken rice, char siew rice and noodles',
  story_text  = 'Uncle Lim learnt the recipe from his father and has been cooking at this centre since 1988.'
WHERE stall_id = 1;

UPDATE public.stalls SET
  name = 'Mariam Nasi Lemak', cuisine = 'Malay', is_halal = true,
  description = 'Nasi lemak, mee goreng and noodle soups',
  story_text  = 'Auntie Mariam wakes at 4am every day to cook her sambal from scratch.'
WHERE stall_id = 2;

UPDATE public.stalls SET
  name = 'Kumar''s Prata Corner', cuisine = 'Indian', is_halal = true,
  description = 'Prata, thosai, briyani and roti john',
  story_text  = 'Mr Kumar can flip over 300 pratas in a morning. Ask him to show you!'
WHERE stall_id = 3;

UPDATE public.stalls SET
  name = 'Wong''s Drinks & Desserts', cuisine = 'Drinks', is_halal = false,
  description = 'Cold drinks, chendol and ice kacang',
  story_text  = 'Auntie Wong''s family stall is over 40 years old and is looking for someone to carry it on.'
WHERE stall_id = 4;

-- Stall 5 (new). owner_id is nullable, so the stall needs no users row.
-- Leroy can link an owner account later. ON CONFLICT does not touch owner_id,
-- so a re-run won't undo that.
INSERT INTO public.stalls
  (stall_id, centre_id, owner_id, name, unit_no, cuisine, description, story_text,
   year_started, seeking_successor, avg_prep_minutes, is_halal, is_open, cover_image_url)
VALUES
  (5, 1, NULL, 'Hakim''s Western Grill', '#01-18', 'Western',
   'Chicken chop, fish & chips and pasta',
   'Encik Hakim cooked in a big hotel kitchen for 15 years before opening his own stall in 2009. He still makes his mushroom sauce from scratch every morning.',
   2009, false, 7, true, true, NULL)
ON CONFLICT (stall_id) DO UPDATE SET
  name = EXCLUDED.name, cuisine = EXCLUDED.cuisine, description = EXCLUDED.description,
  story_text = EXCLUDED.story_text, year_started = EXCLUDED.year_started,
  avg_prep_minutes = EXCLUDED.avg_prep_minutes, is_halal = EXCLUDED.is_halal;

-- -----------------------------------------------------------------------------
-- 2. Menu items (6 per stall). Kid-portion macros, prices in SGD.
--    is_vegetarian = no meat or seafood (egg and milk are allowed).
--    is_available and created_at are not overwritten on re-run.
-- -----------------------------------------------------------------------------
INSERT INTO public.menu_items
  (item_id, stall_id, name, description, price,
   calories, protein_g, carbs_g, fat_g, is_vegetarian, spice_level, default_image_url)
VALUES
  -- Stall 1: Lim's Chicken Rice (Chinese)
  (1,  1, 'Steamed Chicken Rice', 'Soft steamed chicken on yummy chicken-flavoured rice, with cucumber. Chilli comes on the side.', 3.50, 550, 26, 70, 18, false, 1, '/images/menu/chicken-rice.jpg'),
  (2,  1, 'Roasted Chicken Rice', 'Roast chicken with crispy skin on chicken-flavoured rice, with a little sweet soy sauce. Chilli comes on the side.', 3.80, 600, 27, 70, 23, false, 1, '/images/menu/roast-chicken-rice.jpg'),
  (3,  1, 'Kids Chicken Rice Set', 'A smaller plate of steamed chicken and rice, with cucumber and a little bowl of soup. No chilli.', 2.80, 420, 20, 55, 13, false, 0, '/images/menu/kids-chicken-rice.jpg'),
  (13, 1, 'Char Siew Rice', 'Sweet BBQ pork slices on rice, with cucumber.', 3.80, 580, 24, 78, 19, false, 0, '/images/menu/char-siew-rice.jpg'),
  (14, 1, 'Dry Wanton Noodles', 'Springy egg noodles mixed in a tasty sauce, with BBQ pork, green veggies and pork-and-prawn dumplings.', 3.50, 500, 22, 62, 18, false, 1, '/images/menu/wanton-noodles.jpg'),
  (15, 1, 'Fishball Noodle Soup', 'Bouncy fishballs and fishcake in a warm clear soup, with thin egg noodles and veggies.', 3.50, 400, 20, 55, 11, false, 0, '/images/menu/fishball-noodles.jpg'),

  -- Stall 2: Mariam Nasi Lemak (Malay, halal)
  (4,  2, 'Nasi Lemak with Chicken Wing', 'Coconut rice with a crispy fried chicken wing, fried egg, crunchy anchovies, peanuts and spicy sambal.', 4.00, 650, 25, 70, 30, false, 2, '/images/menu/nasi-lemak.jpg'),
  (5,  2, 'Mee Goreng', 'Fried yellow noodles with egg, small prawns and veggies. A bit spicy!', 3.50, 580, 18, 78, 22, false, 2, '/images/menu/mee-goreng.jpg'),
  (6,  2, 'Plain Nasi Lemak (no sambal)', 'Coconut rice with a fried egg and cucumber. No sambal, no anchovies, no meat.', 2.50, 450, 12, 60, 18, true, 0, '/images/menu/plain-nasi-lemak.jpg'),
  (16, 2, 'Mee Soto', 'Yellow noodles in a warm spiced chicken soup, with shredded chicken and bean sprouts.', 3.50, 450, 22, 60, 13, false, 1, '/images/menu/mee-soto.jpg'),
  (17, 2, 'Kids Ayam Goreng Set', 'A crispy fried chicken drumstick with white rice and cucumber. Not spicy.', 3.20, 520, 24, 58, 21, false, 0, '/images/menu/kids-ayam-goreng.jpg'),
  (18, 2, 'Mee Rebus', 'Yellow noodles in a thick, sweet potato gravy with egg, tofu and a squeeze of lime.', 3.50, 520, 18, 72, 18, false, 1, '/images/menu/mee-rebus.jpg'),

  -- Stall 3: Kumar's Prata Corner (Indian, halal). All pratas are 2 pieces, so egg > plain and cheese > egg.
  (7,  3, 'Plain Prata with Dhal (2 pcs)', 'Two crispy, fluffy pratas with a mild lentil curry (dhal) for dipping.', 2.20, 500, 11, 60, 24, true, 1, '/images/menu/prata.jpg'),
  (8,  3, 'Egg Prata with Dhal (2 pcs)', 'Two pratas cooked with egg inside, with mild dhal for dipping.', 3.00, 620, 20, 62, 32, true, 1, '/images/menu/egg-prata.jpg'),
  (9,  3, 'Cheese Prata with Dhal (2 pcs)', 'Two pratas with gooey melted cheese inside, with mild dhal for dipping.', 3.50, 660, 20, 62, 36, true, 1, '/images/menu/cheese-prata.jpg'),
  (19, 3, 'Chicken Briyani', 'Fragrant yellow rice cooked with chicken and spices, topped with cashew nuts and raisins.', 5.00, 680, 30, 85, 24, false, 1, '/images/menu/chicken-briyani.jpg'),
  (20, 3, 'Plain Thosai with Dhal', 'A big, thin, crispy rice pancake with mild dhal and coconut chutney.', 2.00, 330, 9, 55, 8, true, 1, '/images/menu/thosai.jpg'),
  (21, 3, 'Roti John', 'A long toasted bread with egg and minced chicken, plus a little chilli and tomato sauce.', 4.50, 620, 26, 58, 31, false, 1, '/images/menu/roti-john.jpg'),

  -- Stall 4: Wong's Drinks & Desserts
  (10, 4, 'Milo Ice', 'Cold chocolate malt drink with milk.', 1.80, 200, 5, 32, 6, true, 0, '/images/menu/milo.jpg'),
  (11, 4, 'Chendol', 'Shaved ice with coconut milk, palm sugar syrup, green jelly and red beans.', 2.50, 330, 4, 55, 11, true, 0, '/images/menu/chendol.jpg'),
  (12, 4, 'Fresh Watermelon Juice', 'Fresh watermelon blended with ice. No sugar added.', 2.00, 110, 1, 27, 0, true, 0, '/images/menu/watermelon.jpg'),
  (22, 4, 'Soya Bean Milk', 'Cold, smooth soya bean drink. A little sweet.', 1.50, 130, 6, 20, 3, true, 0, '/images/menu/soya-bean.jpg'),
  (23, 4, 'Barley Water', 'A cool, refreshing barley drink. A little sweet.', 1.50, 100, 1, 24, 0, true, 0, '/images/menu/barley.jpg'),
  (24, 4, 'Ice Kacang', 'A mountain of shaved ice with colourful syrup, red beans, sweet corn, jelly, milk and peanuts.', 3.00, 350, 5, 70, 6, true, 0, '/images/menu/ice-kacang.jpg'),

  -- Stall 5: Hakim's Western Grill (Western, halal)
  (25, 5, 'Chicken Chop with Fries', 'Juicy pan-fried chicken with creamy mushroom sauce, fries, coleslaw and baked beans.', 5.50, 700, 32, 60, 36, false, 0, '/images/menu/chicken-chop.jpg'),
  (26, 5, 'Fish & Chips', 'Crispy battered fish with fries, coleslaw and tartar sauce.', 5.50, 650, 26, 62, 33, false, 0, '/images/menu/fish-and-chips.jpg'),
  (27, 5, 'Spaghetti Bolognese', 'Spaghetti with a tomato and minced beef sauce, sprinkled with cheese.', 5.00, 560, 24, 72, 19, false, 0, '/images/menu/spaghetti-bolognese.jpg'),
  (28, 5, 'Chicken Nuggets & Fries', 'Crispy chicken nuggets with fries and tomato sauce.', 4.50, 560, 20, 55, 29, false, 0, '/images/menu/chicken-nuggets.jpg'),
  (29, 5, 'Grilled Chicken with Mashed Potato', 'Grilled chicken with soft mashed potato, gravy and veggies.', 5.80, 520, 35, 45, 22, false, 0, '/images/menu/grilled-chicken.jpg'),
  (30, 5, 'Mac & Cheese', 'Macaroni pasta in a warm, cheesy sauce.', 4.50, 520, 18, 60, 23, true, 0, '/images/menu/mac-and-cheese.jpg')
ON CONFLICT (item_id) DO UPDATE SET
  stall_id = EXCLUDED.stall_id, name = EXCLUDED.name, description = EXCLUDED.description,
  price = EXCLUDED.price, calories = EXCLUDED.calories, protein_g = EXCLUDED.protein_g,
  carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g, is_vegetarian = EXCLUDED.is_vegetarian,
  spice_level = EXCLUDED.spice_level, default_image_url = EXCLUDED.default_image_url;

-- -----------------------------------------------------------------------------
-- 3. Allergen tags. Delete and rebuild for items 1-30 so the list below is the only source.
--    Matched by allergen NAME so it's easy to review. A typo would drop a row
--    silently (an under-tag), so check 5 below counts the rows and aborts if any are missing.
--    The hidden source of each tag is noted in brackets.
-- -----------------------------------------------------------------------------
DELETE FROM public.menu_item_allergens WHERE item_id BETWEEN 1 AND 30;

INSERT INTO public.menu_item_allergens (item_id, allergen_id)
SELECT tag.item_id, a.allergen_id
FROM (VALUES
  -- Stall 1
  (1,'Soy'),(1,'Wheat / gluten'),(1,'Sesame'),                 -- soy sauce = soy + wheat, sesame oil
  (2,'Soy'),(2,'Wheat / gluten'),(2,'Sesame'),                 -- soy sauce, sesame oil
  (3,'Soy'),(3,'Wheat / gluten'),(3,'Sesame'),                 -- soy sauce, sesame oil
  (13,'Soy'),(13,'Wheat / gluten'),(13,'Sesame'),              -- char siew sauce/hoisin, sesame oil
  (14,'Wheat / gluten'),(14,'Egg'),(14,'Soy'),(14,'Sesame'),(14,'Shellfish'), -- egg noodles, wanton wrapper, prawn filling, oyster sauce
  (15,'Fish'),(15,'Wheat / gluten'),(15,'Egg'),(15,'Soy'),     -- fishballs, mee kia (egg noodles), soy sauce
  -- Stall 2
  (4,'Peanuts'),(4,'Egg'),(4,'Shellfish'),(4,'Fish'),(4,'Wheat / gluten'), -- peanuts, fried egg, sambal belacan, ikan bilis, flour on wing
  (5,'Egg'),(5,'Shellfish'),(5,'Soy'),(5,'Wheat / gluten'),    -- yellow noodles, prawns + belacan, kicap manis
  (6,'Egg'),                                                   -- fried egg only (no sambal, no ikan bilis)
  (16,'Wheat / gluten'),(16,'Egg'),(16,'Soy'),                 -- yellow noodles, sambal kicap
  (17,'Wheat / gluten'),(17,'Egg'),                            -- flour + egg coating on drumstick
  (18,'Peanuts'),(18,'Egg'),(18,'Shellfish'),(18,'Soy'),(18,'Wheat / gluten'), -- ground peanuts + dried shrimp in gravy, taucheo + tofu, yellow noodles
  -- Stall 3
  (7,'Wheat / gluten'),(7,'Milk'),                             -- prata dough, ghee in prata and dhal
  (8,'Wheat / gluten'),(8,'Milk'),(8,'Egg'),
  (9,'Wheat / gluten'),(9,'Milk'),                             -- cheese + ghee
  (19,'Milk'),(19,'Tree nuts'),                                -- ghee + yoghurt, cashew topping
  (20,'Milk'),                                                 -- ghee on thosai and in dhal (rice + urad dal batter is gluten-free)
  (21,'Wheat / gluten'),(21,'Egg'),(21,'Milk'),(21,'Soy'),     -- French loaf (often has soy), egg + mayo, butter
  -- Stall 4
  (10,'Milk'),(10,'Wheat / gluten'),(10,'Soy'),                -- malted barley, milk solids, soy lecithin in Milo powder
  -- 11 Chendol: no allergens (coconut milk is not one of the 9; intentionally no rows)
  -- 12 Fresh Watermelon Juice: no allergens (intentionally no rows)
  (22,'Soy'),
  (23,'Wheat / gluten'),                                       -- barley contains gluten
  (24,'Milk'),(24,'Peanuts'),                                  -- evaporated/condensed milk, crushed peanuts
  -- Stall 5
  (25,'Milk'),(25,'Wheat / gluten'),(25,'Egg'),                -- mushroom sauce (butter, cream, flour), coleslaw mayo
  (26,'Fish'),(26,'Wheat / gluten'),(26,'Egg'),                -- batter, tartar sauce/mayo
  (27,'Wheat / gluten'),(27,'Milk'),                           -- pasta, parmesan
  (28,'Wheat / gluten'),(28,'Egg'),(28,'Soy'),                 -- breaded nuggets (often has egg and soy protein)
  (29,'Milk'),(29,'Wheat / gluten'),(29,'Soy'),                -- butter/milk in mash, gravy with flour + soy sauce
  (30,'Wheat / gluten'),(30,'Milk')                            -- macaroni, cheese sauce
) AS tag(item_id, allergen_name)
JOIN public.allergens a ON a.name = tag.allergen_name;

-- -----------------------------------------------------------------------------
-- 4. Add-ons (2-3 per stall). ONE allergen max per the current schema.
--    For add-ons with more than one allergen, the main one is stored here and the
--    rest are listed in the comment. File 2 moves all of them into add_on_allergens.
-- -----------------------------------------------------------------------------
INSERT INTO public.add_ons
  (add_on_id, item_id, name, extra_price, calories, protein_g, carbs_g, fat_g, allergen_id)
VALUES
  -- Stall 1
  (1,  1,  'Extra chicken',          1.50,  150,  14,   0,  10, NULL),
  (2,  1,  'Less rice',              0.00, -100,  -2, -22,   0, NULL),
  (3,  1,  'Add braised egg',        0.80,   80,   6,   1,   5, (SELECT allergen_id FROM public.allergens WHERE name = 'Egg')),            -- ALSO soy + wheat (soy-sauce braise)
  -- Stall 2  (add-on 4 moves from item 2 to item 17. It has no orders.)
  (4,  17, 'Extra drumstick',        1.50,  200,  14,   6,  13, (SELECT allergen_id FROM public.allergens WHERE name = 'Wheat / gluten')), -- ALSO egg (coating)
  (5,  4,  'Add otah',               1.00,   90,   7,   3,   6, (SELECT allergen_id FROM public.allergens WHERE name = 'Fish')),           -- ALSO egg + shellfish (belacan in rempah)
  (6,  4,  'No sambal',              0.00,  -40,   0,  -3,  -3, NULL),  -- unchanged (used in orders)
  -- Stall 3
  (7,  7,  'Extra dhal',             0.50,   60,   3,   7,   2, (SELECT allergen_id FROM public.allergens WHERE name = 'Milk')),           -- ghee
  (10, 8,  'Add cheese',             0.80,   80,   5,   0, 6.5, (SELECT allergen_id FROM public.allergens WHERE name = 'Milk')),
  (11, 19, 'Add hard-boiled egg',    0.80,   75,   6,   1,   5, (SELECT allergen_id FROM public.allergens WHERE name = 'Egg')),
  -- Stall 4
  (8,  10, 'Less sweet',             0.00,  -40,   0, -10,   0, NULL),  -- unchanged (used in orders)
  (9,  11, 'Add red bean',           0.50,   60,   3,  11,   0, NULL),
  (12, 24, 'Add vanilla ice cream',  1.00,  100,   2,  12,   5, (SELECT allergen_id FROM public.allergens WHERE name = 'Milk')),           -- ALSO egg
  -- Stall 5
  (13, 25, 'Extra fries',            1.00,  160,   2,  20,   8, NULL),
  (14, 25, 'Add fried egg',          0.80,   90,   6,   0,   7, (SELECT allergen_id FROM public.allergens WHERE name = 'Egg')),
  (15, 27, 'Extra cheese',           0.80,   80,   5,   0, 6.5, (SELECT allergen_id FROM public.allergens WHERE name = 'Milk'))
ON CONFLICT (add_on_id) DO UPDATE SET
  item_id = EXCLUDED.item_id, name = EXCLUDED.name, extra_price = EXCLUDED.extra_price,
  calories = EXCLUDED.calories, protein_g = EXCLUDED.protein_g, carbs_g = EXCLUDED.carbs_g,
  fat_g = EXCLUDED.fat_g, allergen_id = EXCLUDED.allergen_id;

-- -----------------------------------------------------------------------------
-- 5. Keep the identity sequences ahead of the fixed IDs used above, so the next
--    normal INSERT (e.g. a teammate adding a dish) doesn't collide with ID 13-30.
--    setval is a function call, not a schema change.
-- -----------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('public.stalls', 'stall_id'),     (SELECT MAX(stall_id)  FROM public.stalls));
SELECT setval(pg_get_serial_sequence('public.menu_items', 'item_id'),  (SELECT MAX(item_id)   FROM public.menu_items));
SELECT setval(pg_get_serial_sequence('public.add_ons', 'add_on_id'),   (SELECT MAX(add_on_id) FROM public.add_ons));

-- -----------------------------------------------------------------------------
-- 6. Self-checks. Any RAISE here rolls back the whole file.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tag_count int;
BEGIN
  -- Every stall 1-5 has exactly 6 of our dishes.
  IF EXISTS (
    SELECT s.stall_id
    FROM public.stalls s
    LEFT JOIN public.menu_items m ON m.stall_id = s.stall_id AND m.item_id BETWEEN 1 AND 30
    WHERE s.stall_id BETWEEN 1 AND 5
    GROUP BY s.stall_id
    HAVING COUNT(m.item_id) <> 6
  ) THEN
    RAISE EXCEPTION 'Check failed: a stall does not have exactly 6 dishes.';
  END IF;

  -- 78 tags are listed in section 3. Fewer means an allergen name didn't match (an under-tag).
  SELECT COUNT(*) INTO tag_count FROM public.menu_item_allergens WHERE item_id BETWEEN 1 AND 30;
  IF tag_count <> 78 THEN
    RAISE EXCEPTION 'Check failed: expected 78 allergen tags, found %. An allergen name probably has a typo.', tag_count;
  END IF;

  -- 9 add-ons have an allergen. A typo in a name would leave allergen_id NULL.
  IF (SELECT COUNT(*) FROM public.add_ons WHERE add_on_id BETWEEN 1 AND 15 AND allergen_id IS NOT NULL) <> 9 THEN
    RAISE EXCEPTION 'Check failed: expected 9 add-ons with an allergen. An allergen name probably has a typo.';
  END IF;

  -- A vegetarian dish must not contain fish or shellfish.
  IF EXISTS (
    SELECT 1 FROM public.menu_items m
    JOIN public.menu_item_allergens mia ON mia.item_id = m.item_id
    JOIN public.allergens a ON a.allergen_id = mia.allergen_id
    WHERE m.is_vegetarian AND a.name IN ('Fish', 'Shellfish')
  ) THEN
    RAISE EXCEPTION 'Check failed: a vegetarian dish is tagged with fish or shellfish.';
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Review query (read-only). Run after COMMIT to eyeball every dish and its allergens.
-- -----------------------------------------------------------------------------
SELECT s.name AS stall, m.item_id, m.name AS dish, m.price, m.calories,
       COALESCE(string_agg(a.icon || ' ' || a.name, ', ' ORDER BY a.allergen_id), '(none)') AS allergens,
       m.is_vegetarian AS veg
FROM public.menu_items m
JOIN public.stalls s ON s.stall_id = m.stall_id
LEFT JOIN public.menu_item_allergens mia ON mia.item_id = m.item_id
LEFT JOIN public.allergens a ON a.allergen_id = mia.allergen_id
WHERE m.item_id BETWEEN 1 AND 30
GROUP BY s.stall_id, s.name, m.item_id, m.name, m.price, m.calories, m.is_vegetarian
ORDER BY s.stall_id, m.item_id;
