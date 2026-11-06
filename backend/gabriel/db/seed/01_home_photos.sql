-- =============================================================================
-- 01_home_photos.sql  (Gabriel)
--
-- WHAT IT DOES
--   1. Fixes the broken image links on photos 1 and 2 (they pointed at
--      /uploads/photos/demo-*.jpg, which never existed).
--   2. Adds 9 approved community photos, so the Home "Today's yummiest pics"
--      row has real pictures. 4 of them are dishes Ethan (user 3) can't eat
--      (peanuts / shellfish), so the blocked ⚠️ cards show up.
--   3. Adds votes, so the photos have different like counts. Ice Kacang gets
--      2 photos: the one with more votes is the one Home shows.
--   4. Gives every stall a cover picture (only where it's still empty).
--
-- IMAGES live in frontend/public/images/menu/ (see docs/dish-photos.md), so
-- the paths here start with /images/menu/.
--
-- SAFE TO RE-RUN: photos are only added if that image_url isn't there yet,
-- votes skip duplicates, and covers only fill empty ones.
-- All-or-nothing: if any line fails, nothing is saved (BEGIN/COMMIT).
--
-- HOW TO RUN
--   Supabase dashboard -> KiddyEats Team -> SQL Editor -> New query ->
--   paste this whole file -> Run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Fix the two old photos (both are Kids Chicken Rice Set, item 3)
-- -----------------------------------------------------------------------------
UPDATE photos SET image_url = '/images/menu/kids-chicken-rice.jpg' WHERE photo_id = 1;
UPDATE photos SET image_url = '/images/menu/chicken-rice.jpg'      WHERE photo_id = 2;

-- -----------------------------------------------------------------------------
-- 2. New photos
--    uploaded_by = a kid (3 Ethan, 4 Chloe, 5 Aisyah)
--    ai_status must be 'passed' or Home hides the photo.
--    WHERE NOT EXISTS = skip a row if that picture is already in the table.
-- -----------------------------------------------------------------------------
INSERT INTO photos (item_id, uploaded_by, image_url, ai_status, approval_status)
SELECT v.item_id, v.uploaded_by, v.image_url, 'passed', v.approval_status
FROM (VALUES
  -- item, kid, picture,                              approval
  (18, 4, '/images/menu/mee-rebus.jpg',      'approved'),    -- ⚠️ peanuts, shellfish
  (24, 5, '/images/menu/ice-kacang.jpg',     'not_needed'),  -- ⚠️ peanuts
  (24, 4, '/images/menu/ice-kacang-2.jpg',   'approved'),    -- ⚠️ peanuts (2nd photo)
  (14, 5, '/images/menu/wanton-noodles.jpg', 'approved'),    -- ⚠️ shellfish
  ( 4, 4, '/images/menu/nasi-lemak.jpg',     'not_needed'),  -- ⚠️ peanuts, shellfish
  (30, 3, '/images/menu/mac-and-cheese.jpg', 'approved'),
  (26, 3, '/images/menu/fish-and-chips.jpg', 'not_needed'),
  (25, 5, '/images/menu/chicken-chop.jpg',   'approved'),
  ( 7, 3, '/images/menu/prata.jpg',          'approved')
) AS v(item_id, uploaded_by, image_url, approval_status)
WHERE NOT EXISTS (SELECT 1 FROM photos p WHERE p.image_url = v.image_url);

-- -----------------------------------------------------------------------------
-- 3. Votes
--    For each picture, the first N users (by user_id) like it.
--    We look the photo up by its image_url because we don't know the new
--    photo_ids (the database made them in step 2).
--    ON CONFLICT DO NOTHING = a user can't like the same photo twice
--    (photo_votes' primary key is (photo_id, user_id)).
-- -----------------------------------------------------------------------------
INSERT INTO photo_votes (photo_id, user_id)
SELECT p.photo_id, u.user_id
FROM (VALUES
  ('/images/menu/mee-rebus.jpg',      9),
  ('/images/menu/ice-kacang-2.jpg',   8),   -- beats ice-kacang.jpg, so Home shows this one
  ('/images/menu/nasi-lemak.jpg',     7),
  ('/images/menu/chicken-chop.jpg',   6),
  ('/images/menu/mac-and-cheese.jpg', 5),
  ('/images/menu/fish-and-chips.jpg', 4),
  ('/images/menu/wanton-noodles.jpg', 4),
  ('/images/menu/ice-kacang.jpg',     3),
  ('/images/menu/prata.jpg',          2)
) AS v(image_url, how_many)
JOIN photos p ON p.image_url = v.image_url
CROSS JOIN LATERAL (
  SELECT user_id FROM users ORDER BY user_id LIMIT v.how_many
) AS u
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Stall covers (reuse one dish picture per stall; only fill empty ones)
-- -----------------------------------------------------------------------------
UPDATE stalls SET cover_image_url = '/images/menu/chicken-rice.jpg' WHERE stall_id = 1 AND cover_image_url IS NULL;
UPDATE stalls SET cover_image_url = '/images/menu/nasi-lemak.jpg'   WHERE stall_id = 2 AND cover_image_url IS NULL;
UPDATE stalls SET cover_image_url = '/images/menu/prata.jpg'        WHERE stall_id = 3 AND cover_image_url IS NULL;
UPDATE stalls SET cover_image_url = '/images/menu/ice-kacang-2.jpg' WHERE stall_id = 4 AND cover_image_url IS NULL;
UPDATE stalls SET cover_image_url = '/images/menu/chicken-chop.jpg' WHERE stall_id = 5 AND cover_image_url IS NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- CHECK (run after): one row per dish, the photo Home will show, and its likes
-- -----------------------------------------------------------------------------
-- SELECT p.photo_id, m.name, p.image_url, COUNT(v.user_id) AS likes
-- FROM photos p
-- JOIN menu_items m ON m.item_id = p.item_id
-- LEFT JOIN photo_votes v ON v.photo_id = p.photo_id
-- GROUP BY p.photo_id, m.name
-- ORDER BY likes DESC;
