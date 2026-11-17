-- =============================================================================
-- 02_second_centre.sql  (Gabriel)
--
-- WHY
--   Stakeholder feedback: Home's "Stalls near you" had no hawker centre level.
--   Home now has a hawker centre dropdown, so we need a 2nd centre to pick.
--
-- WHAT IT DOES
--   1. Adds hawker centre 2: Maple Grove Hawker Centre.
--   2. Adds 3 open stalls there (stall_id 6, 7, 8).
--   3. Adds 4 dishes per stall (item_id 31 to 42).
--   4. Tags each dish with its allergens, so the safety rules can judge it.
--
-- IDs: Raghav's 01_stalls_menu.sql owns stalls 1-5 and dishes 1-30, and its
-- self-checks only look at those IDs. This file starts after them, so both
-- files can be re-run without clashing.
--
-- PICTURES: no new photos. These dishes reuse the pictures in
-- frontend/public/images/menu/ (two stalls can sell the same dish).
--
-- SAFE TO RE-RUN: rows are only added if their ID isn't there yet, and the
-- allergen tags for items 31-42 are deleted and re-added.
-- All-or-nothing: if any line fails, nothing is saved (BEGIN/COMMIT).
--
-- HOW TO RUN
--   Supabase dashboard -> KiddyEats Team -> SQL Editor -> New query ->
--   paste this whole file -> Run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. The hawker centre
-- -----------------------------------------------------------------------------
INSERT INTO public.hawker_centres (centre_id, name, address, near_school)
VALUES (2, 'Maple Grove Hawker Centre', '8 Maple Grove Road, Singapore 570008', 'Maple Grove Primary School')
ON CONFLICT (centre_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Stalls (owner_id NULL: no stall owner account yet, same as Raghav's stall 5)
-- -----------------------------------------------------------------------------
INSERT INTO public.stalls
  (stall_id, centre_id, owner_id, name, unit_no, cuisine, description, story_text,
   year_started, avg_prep_minutes, is_halal, is_open, cover_image_url)
VALUES
  (6, 2, NULL, 'Ah Hock Noodle House', '#01-03', 'Chinese',
   'Fishball noodles, wanton noodles and rice plates',
   'Uncle Ah Hock still makes his fishballs by hand every morning, the way his mother taught him.',
   1991, 5, false, true, '/images/menu/fishball-noodles.jpg'),
  (7, 2, NULL, 'Siti''s Kampung Kitchen', '#01-07', 'Malay',
   'Nasi lemak, mee soto and fried chicken',
   'Makcik Siti started cooking for her neighbours in the kampung before opening her stall.',
   2005, 5, true, true, '/images/menu/plain-nasi-lemak.jpg'),
  (8, 2, NULL, 'Cool Corner Drinks', '#01-11', 'Drinks',
   'Cold drinks and desserts',
   'Brothers Daniel and Marcus took over their grandparents'' drinks stall in 2015.',
   1979, 3, false, true, '/images/menu/soya-bean.jpg')
ON CONFLICT (stall_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Dishes
-- -----------------------------------------------------------------------------
INSERT INTO public.menu_items
  (item_id, stall_id, name, description, price, calories, protein_g, carbs_g, fat_g,
   fibre_g, sugar_g, is_vegetarian, spice_level, is_fried, is_available, default_image_url)
VALUES
  -- Ah Hock Noodle House (6)
  (31, 6, 'Fishball Noodles (Dry)', 'Thin noodles tossed in a light sauce with handmade fishballs and veggies.',
   3.50, 420, 20.0, 58.0, 12.0, 2.0, 4.0, false, 0, false, true, '/images/menu/fishball-noodles.jpg'),
  (32, 6, 'Wanton Noodle Soup', 'Egg noodles in a clear soup with pork-and-prawn dumplings and green veggies.',
   3.80, 450, 21.0, 58.0, 14.0, 3.0, 4.0, false, 0, false, true, '/images/menu/wanton-noodles.jpg'),
  (33, 6, 'Char Siew Rice', 'Sweet BBQ pork slices on rice, with cucumber.',
   4.00, 580, 24.0, 78.0, 19.0, 2.0, 12.0, false, 0, false, true, '/images/menu/char-siew-rice.jpg'),
  (34, 6, 'Kids Chicken Rice', 'A small plate of steamed chicken and rice with cucumber. No chilli.',
   3.00, 420, 20.0, 55.0, 13.0, 1.5, 2.0, false, 0, false, true, '/images/menu/kids-chicken-rice.jpg'),
  -- Siti's Kampung Kitchen (7)
  (35, 7, 'Plain Nasi Lemak', 'Coconut rice with a fried egg and cucumber. No sambal.',
   2.80, 450, 12.0, 60.0, 18.0, 2.0, 3.0, true, 0, false, true, '/images/menu/plain-nasi-lemak.jpg'),
  (36, 7, 'Mee Soto', 'Yellow noodles in a warm spiced chicken soup, with shredded chicken and bean sprouts.',
   3.80, 450, 22.0, 60.0, 13.0, 3.0, 4.0, false, 1, false, true, '/images/menu/mee-soto.jpg'),
  (37, 7, 'Ayam Goreng with Rice', 'A crispy fried chicken drumstick with white rice and cucumber. Not spicy.',
   3.50, 520, 24.0, 58.0, 21.0, 2.0, 3.0, false, 0, true, true, '/images/menu/kids-ayam-goreng.jpg'),
  (38, 7, 'Mee Goreng', 'Fried yellow noodles with egg, small prawns and veggies. A bit spicy!',
   3.80, 580, 18.0, 78.0, 22.0, 3.0, 9.0, false, 2, true, true, '/images/menu/mee-goreng.jpg'),
  -- Cool Corner Drinks (8)
  (39, 8, 'Soya Bean Milk', 'Cold, smooth soya bean drink. A little sweet.',
   1.60, 130, 6.0, 20.0, 3.0, 1.0, 14.0, true, 0, false, true, '/images/menu/soya-bean.jpg'),
  (40, 8, 'Barley Water', 'A cool, refreshing barley drink. A little sweet.',
   1.50, 100, 1.0, 24.0, 0.0, 1.0, 20.0, true, 0, false, true, '/images/menu/barley.jpg'),
  (41, 8, 'Milo Ice', 'Cold chocolate malt drink with milk.',
   2.00, 200, 5.0, 32.0, 6.0, 1.0, 26.0, true, 0, false, true, '/images/menu/milo.jpg'),
  (42, 8, 'Ice Kacang', 'Shaved ice with colourful syrup, red beans, sweet corn, jelly, milk and peanuts.',
   3.20, 350, 5.0, 70.0, 6.0, 4.0, 50.0, true, 0, false, true, '/images/menu/ice-kacang.jpg')
ON CONFLICT (item_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Allergen tags (by name, same list as the matching dishes in Raghav's seed)
--    Every dish gets at least one tag: a dish with NO tags is locked for any kid
--    with allergies (Raghav's fail-closed rule in dishSafety.js).
-- -----------------------------------------------------------------------------
DELETE FROM public.menu_item_allergens WHERE item_id BETWEEN 31 AND 42;

INSERT INTO public.menu_item_allergens (item_id, allergen_id)
SELECT v.item_id, a.allergen_id
FROM (VALUES
  (31, 'Egg'), (31, 'Fish'), (31, 'Soy'), (31, 'Wheat / gluten'),
  (32, 'Egg'), (32, 'Shellfish'), (32, 'Soy'), (32, 'Wheat / gluten'), (32, 'Sesame'),
  (33, 'Soy'), (33, 'Wheat / gluten'), (33, 'Sesame'),
  (34, 'Soy'), (34, 'Wheat / gluten'), (34, 'Sesame'),
  (35, 'Egg'),
  (36, 'Egg'), (36, 'Soy'), (36, 'Wheat / gluten'),
  (37, 'Egg'), (37, 'Wheat / gluten'),
  (38, 'Egg'), (38, 'Shellfish'), (38, 'Soy'), (38, 'Wheat / gluten'),
  (39, 'Soy'),
  (40, 'Wheat / gluten'),
  (41, 'Milk'), (41, 'Soy'), (41, 'Wheat / gluten'),
  (42, 'Peanuts'), (42, 'Milk')
) AS v(item_id, allergen_name)
JOIN public.allergens a ON a.name = v.allergen_name;

-- keep the ID counters ahead of the fixed IDs (same as Raghav's seed)
SELECT setval(pg_get_serial_sequence('public.hawker_centres', 'centre_id'), (SELECT MAX(centre_id) FROM public.hawker_centres));
SELECT setval(pg_get_serial_sequence('public.stalls', 'stall_id'),         (SELECT MAX(stall_id)  FROM public.stalls));
SELECT setval(pg_get_serial_sequence('public.menu_items', 'item_id'),      (SELECT MAX(item_id)   FROM public.menu_items));

-- -----------------------------------------------------------------------------
-- 5. Self-checks. Any RAISE here rolls back the whole file.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.stalls WHERE centre_id = 2) <> 3 THEN
    RAISE EXCEPTION 'Check failed: Maple Grove should have 3 stalls.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.stalls s LEFT JOIN public.menu_items m ON m.stall_id = s.stall_id
    WHERE s.stall_id BETWEEN 6 AND 8 GROUP BY s.stall_id HAVING COUNT(m.item_id) <> 4
  ) THEN
    RAISE EXCEPTION 'Check failed: a Maple Grove stall does not have exactly 4 dishes.';
  END IF;
  -- 32 tags are listed in section 4. Fewer means an allergen name didn't match.
  IF (SELECT COUNT(*) FROM public.menu_item_allergens WHERE item_id BETWEEN 31 AND 42) <> 32 THEN
    RAISE EXCEPTION 'Check failed: expected 32 allergen tags. An allergen name probably has a typo.';
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- CHECK (run after): each centre with its stalls and how many dishes each has
-- -----------------------------------------------------------------------------
-- SELECT h.name AS centre, s.stall_id, s.name AS stall, COUNT(m.item_id) AS dishes
-- FROM hawker_centres h
-- JOIN stalls s ON s.centre_id = h.centre_id
-- LEFT JOIN menu_items m ON m.stall_id = s.stall_id
-- GROUP BY h.centre_id, s.stall_id
-- ORDER BY h.centre_id, s.stall_id;
