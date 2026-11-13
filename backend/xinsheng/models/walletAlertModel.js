// Model: child_wallet_alerts (parent picks when the low wallet alert shows)
// no row = alert when the wallet is under one day's limit
const pool = require("../../config/db");

// table not made yet in Supabase -> act like nobody set one
const NO_TABLE = "42P01";

async function getForChildren(childIds) {
  try {
    const { rows } = await pool.query(
      `SELECT child_id, alert_below FROM child_wallet_alerts WHERE child_id = ANY($1::int[])`,
      [childIds]
    );
    return rows;
  } catch (err) {
    if (err.code === NO_TABLE) return [];
    throw err;
  }
}

// amount null = back to the normal (one day's limit)
async function setAlert(childId, amount) {
  if (amount === null) {
    await pool.query(`DELETE FROM child_wallet_alerts WHERE child_id = $1`, [childId]);
    return;
  }
  await pool.query(
    `INSERT INTO child_wallet_alerts (child_id, alert_below) VALUES ($1, $2)
     ON CONFLICT (child_id) DO UPDATE SET alert_below = EXCLUDED.alert_below`,
    [childId, amount]
  );
}

module.exports = { getForChildren, setAlert };
