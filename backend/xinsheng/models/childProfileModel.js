// Model: child_profiles table (which parent owns which kid)
const pool = require("../../config/db");

async function isParentOf(parentId, childId) {
  const { rows } = await pool.query(
    `SELECT child_id FROM child_profiles WHERE child_id = $1 AND parent_id = $2`,
    [childId, parentId]
  );
  return rows.length > 0;
}

// a parent's kids with their wallet, for the parent home
async function listForParent(parentId) {
  const { rows } = await pool.query(
    `SELECT c.child_id, u.display_name, u.avatar_emoji, c.wallet_balance, c.daily_limit
       FROM child_profiles c JOIN users u ON u.user_id = c.child_id
      WHERE c.parent_id = $1 AND u.is_active
      ORDER BY u.display_name`,
    [parentId]
  );
  return rows;
}

module.exports = { isParentOf, listForParent };
