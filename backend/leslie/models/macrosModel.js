// Model: what a kid ate (orders + order_items) and the daily guide for their age (nutrient_guides)
const pool = require("../../config/db");

// name + birth year, for the header and to pick the age guide
async function getChild(childId) {
  const { rows } = await pool.query(
    `SELECT u.user_id AS child_id, u.display_name, c.birth_year
       FROM child_profiles c JOIN users u ON u.user_id = c.child_id
      WHERE c.child_id = $1`,
    [childId]
  );
  return rows[0];
}

// guide row for this age, or the default row when the age is unknown or outside every band.
// Returns null if the nutrient_guides table hasn't been made yet (migration 003 not run).
async function getGuide(age) {
  try {
    const { rows } = await pool.query(
      `SELECT age_from, age_to, kcal, carbs_g, protein_g, fat_g, fibre_g, sugar_g
         FROM nutrient_guides
        WHERE ($1::int BETWEEN age_from AND age_to) OR is_default
        ORDER BY ($1::int BETWEEN age_from AND age_to) DESC NULLS LAST
        LIMIT 1`,
      [age]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === "42P01") return null; // table missing
    throw err;
  }
}

// A kid's orders between two Singapore dates (inclusive), newest first, cancelled ones left out.
// Each order comes with its dishes (name, qty, kcal, macros) and the kid's allergens found in it.
// fibre/sugar: the order-time snapshot, else the dish's current value, else null.
// (read through to_jsonb so this still runs before migration 003 adds those columns)
async function getOrders(childId, fromDate, toDate) {
  const { rows } = await pool.query(
    `SELECT o.order_id, o.placed_at, o.total_amount, s.name AS stall_name,
            to_char(o.placed_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS day,
            json_agg(json_build_object(
              'name', oi.item_name,
              'qty', oi.quantity,
              'kcal', oi.calories,
              'carbs', oi.carbs_g,
              'protein', oi.protein_g,
              'fat', oi.fat_g,
              'fibre', COALESCE(to_jsonb(oi) ->> 'fibre_g', to_jsonb(m) ->> 'fibre_g'),
              'sugar', COALESCE(to_jsonb(oi) ->> 'sugar_g', to_jsonb(m) ->> 'sugar_g'),
              'checked', COALESCE(m.allergens_checked, false)
            ) ORDER BY oi.order_item_id) AS items,
            ARRAY(
              SELECT a.name FROM order_items x
                JOIN menu_item_allergens mia ON mia.item_id = x.item_id
                JOIN child_allergies ca ON ca.allergen_id = mia.allergen_id AND ca.child_id = o.child_id
                JOIN allergens a ON a.allergen_id = mia.allergen_id
               WHERE x.order_id = o.order_id
              UNION
              SELECT a.name FROM order_items x
                JOIN order_item_add_ons oa ON oa.order_item_id = x.order_item_id
                JOIN add_on_allergens aa ON aa.add_on_id = oa.add_on_id
                JOIN child_allergies ca ON ca.allergen_id = aa.allergen_id AND ca.child_id = o.child_id
                JOIN allergens a ON a.allergen_id = aa.allergen_id
               WHERE x.order_id = o.order_id
            ) AS clashes
       FROM orders o
       JOIN stalls s ON s.stall_id = o.stall_id
       JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN menu_items m ON m.item_id = oi.item_id
      WHERE o.child_id = $1
        AND o.status <> 'cancelled'
        AND o.placed_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Singapore')
        AND o.placed_at <  (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Singapore')
      GROUP BY o.order_id, s.name
      ORDER BY o.placed_at DESC`,
    [childId, fromDate, toDate]
  );
  return rows;
}

module.exports = { getChild, getGuide, getOrders };
