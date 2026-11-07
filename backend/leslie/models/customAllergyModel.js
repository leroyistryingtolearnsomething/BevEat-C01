// Model: custom allergies a parent types in for one child (child_custom_allergies, migration 005).
// The word matching itself lives in the database (mentions_food + the v_child_custom_allergy_* views),
// so the parent screen, Home and the menu all block exactly the same dishes.
const pool = require("../../config/db");

// a child's custom allergies, each with the dishes it blocks right now (so the parent can check)
async function listForChild(childId) {
  const { rows } = await pool.query(
    `SELECT ca.custom_allergy_id, ca.label, ca.icon,
            COALESCE(array_agg(m.name ORDER BY m.name) FILTER (WHERE m.item_id IS NOT NULL), '{}') AS blocked_dishes
       FROM child_custom_allergies ca
       LEFT JOIN v_child_custom_allergy_items v
              ON v.child_id = ca.child_id AND lower(v.label) = lower(ca.label)
       LEFT JOIN menu_items m ON m.item_id = v.item_id
      WHERE ca.child_id = $1
      GROUP BY ca.custom_allergy_id
      ORDER BY ca.created_at, ca.custom_allergy_id`,
    [childId]
  );
  return rows;
}

async function countForChild(childId) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM child_custom_allergies WHERE child_id = $1`, [childId]);
  return rows[0].n;
}

// preset allergen names, so a parent who types "egg" is pointed to the Egg chip instead
async function presetNames() {
  const { rows } = await pool.query(`SELECT name FROM allergens ORDER BY allergen_id`);
  return rows.map((r) => r.name);
}

// throws pg error 23505 if this child already has this word (any capitals)
async function add(childId, label) {
  const { rows } = await pool.query(
    `INSERT INTO child_custom_allergies (child_id, label) VALUES ($1, $2)
     RETURNING custom_allergy_id, label, icon`,
    [childId, label]
  );
  return rows[0];
}

// true if a row was removed (only ever this child's own row)
async function remove(childId, customAllergyId) {
  const { rowCount } = await pool.query(
    `DELETE FROM child_custom_allergies WHERE child_id = $1 AND custom_allergy_id = $2`,
    [childId, customAllergyId]
  );
  return rowCount > 0;
}

// for the kid's menu: which dishes and add-ons a custom allergy blocks
async function blockedItems(childId) {
  const { rows } = await pool.query(
    `SELECT item_id, label, icon FROM v_child_custom_allergy_items WHERE child_id = $1`,
    [childId]
  );
  return rows;
}

async function blockedAddOns(childId) {
  const { rows } = await pool.query(
    `SELECT add_on_id, label, icon FROM v_child_custom_allergy_add_ons WHERE child_id = $1`,
    [childId]
  );
  return rows;
}

module.exports = { listForChild, countForChild, presetNames, add, remove, blockedItems, blockedAddOns };
