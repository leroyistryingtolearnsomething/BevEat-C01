// Model: child_food_rules (what a parent locks for a child), and the dishes the parent can lock
const pool = require("../../config/db");

// Every dish on sale today, with the stall it is from and its allergens, plus whether this child's
// parent has locked it. LEFT JOIN keeps a dish that has no allergen rows (allergens unknown).
async function listMenuForChild(childId) {
  const { rows } = await pool.query(
    `SELECT m.item_id, m.name, m.price, m.default_image_url, s.name AS stall_name,
            COALESCE(array_agg(a.name ORDER BY a.allergen_id) FILTER (WHERE a.allergen_id IS NOT NULL), '{}') AS allergen_names,
            EXISTS (SELECT 1 FROM child_food_rules r
                     WHERE r.child_id = $1 AND r.rule_type = 'blocked_item' AND r.item_id = m.item_id) AS locked
       FROM menu_items m
       JOIN stalls s ON s.stall_id = m.stall_id
       LEFT JOIN menu_item_allergens mia ON mia.item_id = m.item_id
       LEFT JOIN allergens a ON a.allergen_id = mia.allergen_id
      WHERE m.is_available
      GROUP BY m.item_id, s.stall_id
      ORDER BY s.name, m.item_id`,
    [childId]
  );
  return rows;
}

// Lock a dish for a child. Returns false if the dish doesn't exist. Locking twice is fine.
async function lockItem(childId, itemId) {
  const { rowCount } = await pool.query(
    `INSERT INTO child_food_rules (child_id, rule_type, item_id)
     SELECT $1, 'blocked_item', item_id FROM menu_items WHERE item_id = $2
     ON CONFLICT DO NOTHING`,
    [childId, itemId]
  );
  if (rowCount > 0) return true;
  const { rows } = await pool.query(`SELECT 1 FROM menu_items WHERE item_id = $1`, [itemId]);
  return rows.length > 0;
}

async function unlockItem(childId, itemId) {
  await pool.query(
    `DELETE FROM child_food_rules WHERE child_id = $1 AND rule_type = 'blocked_item' AND item_id = $2`,
    [childId, itemId]
  );
}

// What the kid's menu reads (Raghav's dishSafety): one rule per locked dish, labelled with the dish name
async function listRulesForChild(childId) {
  const { rows } = await pool.query(
    `SELECT r.rule_type, r.item_id, m.name
       FROM child_food_rules r
       LEFT JOIN menu_items m ON m.item_id = r.item_id
      WHERE r.child_id = $1
      ORDER BY r.rule_id`,
    [childId]
  );
  return rows;
}

module.exports = { listMenuForChild, lockItem, unlockItem, listRulesForChild };
