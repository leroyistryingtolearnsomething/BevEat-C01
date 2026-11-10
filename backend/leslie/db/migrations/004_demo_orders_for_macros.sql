-- =============================================================================
-- KiddyEats 004: demo orders so the parent macros screens have data to show
-- Run AFTER 003. This is demo data, not schema. Safe to re-run: it first
-- removes the demo orders it made before (tagged 'demo-seed' in the comment).
--
-- WHAT IT DOES
--   For ONE kid (set kid_username below) it adds 2 collected orders a day
--   (about 12:30pm lunch + 3:15pm snack, Singapore time) for every school day
--   (Mon-Fri) of last week and this week up to today, plus today even on a
--   weekend so the "Today" screen has something. Dishes are picked only from
--   that kid's allergy-safe, available menu, so the demo matches what the kid
--   could really order. It does not touch the wallet.
--
-- HOW TO RUN
--   SQL Editor -> paste -> change kid_username if you want -> Run.
--
-- TO REMOVE THE DEMO ORDERS LATER
--   DELETE FROM orders WHERE order_id IN
--     (SELECT order_id FROM order_items WHERE comment = 'demo-seed');
-- =============================================================================

DO $$
DECLARE
  kid_username text := 'test_ting';     -- <== the kid to fill (users.username)
  kid_id   integer;
  safe     integer[];                   -- allergy-safe dish ids, mains first
  drinks   integer[];
  d        date;
  today    date := (now() AT TIME ZONE 'Asia/Singapore')::date;
  week0    date := date_trunc('week', (now() AT TIME ZONE 'Asia/Singapore'))::date - 7;  -- last Monday
  n        integer := 0;
  slot     integer;
  item     menu_items%ROWTYPE;
  new_id   integer;
  at       timestamptz;
BEGIN
  SELECT user_id INTO kid_id FROM users WHERE role = 'child' AND lower(username) = lower(kid_username);
  IF kid_id IS NULL THEN RAISE EXCEPTION 'No kid with username %', kid_username; END IF;

  -- remove this script's earlier demo orders for this kid
  DELETE FROM orders o
   WHERE o.child_id = kid_id
     AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.order_id AND oi.comment = 'demo-seed');

  -- dishes with none of the kid's allergens
  SELECT array_agg(m.item_id ORDER BY m.item_id) INTO safe
    FROM menu_items m
   WHERE m.is_available AND m.calories >= 300
     AND NOT EXISTS (SELECT 1 FROM menu_item_allergens mia JOIN child_allergies ca
                       ON ca.allergen_id = mia.allergen_id AND ca.child_id = kid_id
                     WHERE mia.item_id = m.item_id);
  SELECT array_agg(m.item_id ORDER BY m.item_id) INTO drinks
    FROM menu_items m
   WHERE m.is_available AND m.calories < 300
     AND NOT EXISTS (SELECT 1 FROM menu_item_allergens mia JOIN child_allergies ca
                       ON ca.allergen_id = mia.allergen_id AND ca.child_id = kid_id
                     WHERE mia.item_id = m.item_id);
  IF safe IS NULL THEN RAISE EXCEPTION 'No allergy-safe dishes for %', kid_username; END IF;
  drinks := COALESCE(drinks, safe);

  FOR d IN SELECT g::date FROM generate_series(week0, today, interval '1 day') g LOOP
    CONTINUE WHEN extract(isodow FROM d) > 5 AND d <> today;
    FOR slot IN 1..2 LOOP
      n := n + 1;
      IF slot = 1 THEN
        SELECT * INTO item FROM menu_items WHERE item_id = safe[1 + (n * 7) % array_length(safe, 1)];
        at := (d + time '12:30' + (n % 4) * interval '5 minutes') AT TIME ZONE 'Asia/Singapore';
      ELSE
        SELECT * INTO item FROM menu_items WHERE item_id = drinks[1 + (n * 3) % array_length(drinks, 1)];
        at := (d + time '15:15' + (n % 3) * interval '5 minutes') AT TIME ZONE 'Asia/Singapore';
      END IF;
      CONTINUE WHEN at > now();   -- nothing in the future

      INSERT INTO orders (child_id, stall_id, queue_number, status, total_amount, payment_method,
                          placed_at, estimated_ready_at, ready_at, collected_at)
      VALUES (kid_id, item.stall_id, 100 + n, 'collected', item.price, 'wallet',
              at, at + interval '8 minutes', at + interval '8 minutes', at + interval '10 minutes')
      RETURNING order_id INTO new_id;

      INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price, comment,
                               calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g)
      VALUES (new_id, item.item_id, item.name, 1, item.price, 'demo-seed',
              item.calories, item.protein_g, item.carbs_g, item.fat_g, item.fibre_g, item.sugar_g);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Added demo orders for % (child_id %)', kid_username, kid_id;
END $$;
