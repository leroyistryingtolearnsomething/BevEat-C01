// Model: dishes, their allergens and add-ons (menu_items, menu_item_allergens, add_ons).
// SQL only, returns plain rows. Every value from the user travels as a $ parameter.
const pool = require("../../config/db");

// One row per dish, with its allergen names collected into an array.
// LEFT JOINs keep a dish that has no allergen rows; FILTER turns its [NULL] into an empty array,
// which is what dishSafety needs to spot "allergens unknown" and fail closed.
// is_fried / is_low_sugar / sugar_g are what Mum's food rules check (schema request #7, migration 006).
const DISH_COLUMNS = `m.item_id, m.stall_id, m.name, m.description, m.price, m.default_image_url,
       m.is_fried, m.is_low_sugar, m.sugar_g,
       COALESCE(array_agg(a.name ORDER BY a.allergen_id) FILTER (WHERE a.allergen_id IS NOT NULL), '{}') AS allergen_names`;

const DISH_JOINS = `FROM menu_items m
     LEFT JOIN menu_item_allergens mia ON mia.item_id = m.item_id
     LEFT JOIN allergens a ON a.allergen_id = mia.allergen_id`;

// is_available = false means the stall has run out today, so it isn't on the menu at all
async function getAvailableDishesForStall(stallId) {
  const { rows } = await pool.query(
    `SELECT ${DISH_COLUMNS}
     ${DISH_JOINS}
     WHERE m.stall_id = $1 AND m.is_available
     GROUP BY m.item_id
     ORDER BY m.item_id`,
    [stallId]
  );
  return rows;
}

async function getAvailableDish(itemId) {
  const { rows } = await pool.query(
    `SELECT ${DISH_COLUMNS}, s.name AS stall_name
     ${DISH_JOINS}
     JOIN stalls s ON s.stall_id = m.stall_id
     WHERE m.item_id = $1 AND m.is_available
     GROUP BY m.item_id, s.stall_id`,
    [itemId]
  );
  return rows[0]; // undefined if there's no such dish, or it's sold out
}

async function getAddOns(itemId) {
  const { rows } = await pool.query(
    `SELECT ao.add_on_id, ao.name, ao.extra_price, al.name AS allergen_name, al.icon AS allergen_icon
     FROM add_ons ao
     LEFT JOIN allergens al ON al.allergen_id = ao.allergen_id
     WHERE ao.item_id = $1
     ORDER BY ao.add_on_id`,
    [itemId]
  );
  return rows;
}

// MOCK: replace when Gabriel's getTopPhotos is ready (docs/api-contracts.md §2d).
// The top photo of each dish uses the rule agreed for Home: AI check passed, approved (or no
// approval needed), most hearts, newest first on a tie. One query for all dishes on a screen.
async function getTopPhotos(itemIds, viewerId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.item_id)
            p.item_id, p.photo_id, p.image_url, u.username,
            COUNT(v.user_id)::int AS hearts,
            COALESCE(BOOL_OR(v.user_id = $2), false) AS liked_by_me,
            (COUNT(*) OVER (PARTITION BY p.item_id))::int AS total_pics
     FROM photos p
     LEFT JOIN users u ON u.user_id = p.uploaded_by
     LEFT JOIN photo_votes v ON v.photo_id = p.photo_id
     WHERE p.item_id = ANY($1::int[])
       AND p.ai_status = 'passed'
       AND p.approval_status IN ('approved', 'not_needed')
     GROUP BY p.photo_id, u.username
     ORDER BY p.item_id, hearts DESC, p.uploaded_at DESC`,
    [itemIds, viewerId]
  );
  return rows; // total_pics is counted before DISTINCT ON keeps the top photo, so it's every approved pic
}

// Same rows as the stall menu, for a list of dishes from any stall (Gabriel's Home "yummiest pics")
async function getAvailableDishesByIds(itemIds) {
  const { rows } = await pool.query(
    `SELECT ${DISH_COLUMNS}
     ${DISH_JOINS}
     WHERE m.item_id = ANY($1::int[]) AND m.is_available
     GROUP BY m.item_id`,
    [itemIds]
  );
  return rows;
}

// Tray: every dish in the tray in ONE query. Unlike the menu queries this keeps sold-out dishes
// (is_available = false) and returns the stall's is_open, so the tray can tell the kid WHY a
// dish can't be ordered any more instead of it just disappearing. Macros are for Leroy's
// order_items snapshot.
async function getDishesForTray(itemIds) {
  const { rows } = await pool.query(
    `SELECT ${DISH_COLUMNS}, m.is_available, m.calories, m.protein_g, m.carbs_g, m.fat_g,
            s.name AS stall_name, s.is_open AS stall_is_open
     ${DISH_JOINS}
     JOIN stalls s ON s.stall_id = m.stall_id
     WHERE m.item_id = ANY($1::int[])
     GROUP BY m.item_id, s.stall_id`,
    [itemIds]
  );
  return rows;
}

// Tray: every add-on of every dish in the tray, in one query. item_id is returned so the tray
// can check each chosen add-on really belongs to the dish it was picked for.
async function getAddOnsForItems(itemIds) {
  const { rows } = await pool.query(
    `SELECT ao.add_on_id, ao.item_id, ao.name, ao.extra_price,
            ao.calories, ao.protein_g, ao.carbs_g, ao.fat_g, al.name AS allergen_name
     FROM add_ons ao
     LEFT JOIN allergens al ON al.allergen_id = ao.allergen_id
     WHERE ao.item_id = ANY($1::int[])
     ORDER BY ao.add_on_id`,
    [itemIds]
  );
  return rows;
}

module.exports = {
  getAvailableDishesForStall, getAvailableDish, getAvailableDishesByIds, getAddOns, getTopPhotos,
  getDishesForTray, getAddOnsForItems,
};
