// Model: child_profiles table (which parent owns which kid)
const pool = require("../../config/db");

async function isParentOf(parentId, childId) {
  const { rows } = await pool.query(
    `SELECT child_id FROM child_profiles WHERE child_id = $1 AND parent_id = $2`,
    [childId, parentId]
  );
  return rows.length > 0;
}

module.exports = { isParentOf };
