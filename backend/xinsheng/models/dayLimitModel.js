// Model: child_day_limits table (a different limit for some weekdays)
// weekday 0 = Sunday ... 6 = Saturday, same as JS getDay() and Postgres DOW
// days with no row use child_profiles.daily_limit
const pool = require("../../config/db");

async function getDayLimits(childId) {
  const { rows } = await pool.query(
    `SELECT weekday, daily_limit FROM child_day_limits WHERE child_id = $1 ORDER BY weekday`,
    [childId]
  );
  return rows;
}

// for the parent alerts (all their kids at once)
async function getDayLimitsForChildren(childIds) {
  const { rows } = await pool.query(
    `SELECT child_id, weekday, daily_limit FROM child_day_limits WHERE child_id = ANY($1::int[])`,
    [childIds]
  );
  return rows;
}

// replaces all of a kid's weekday limits, list is [{ weekday, dailyLimit }]
async function setDayLimits(childId, list) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM child_day_limits WHERE child_id = $1`, [childId]);
    for (const d of list) {
      await client.query(
        `INSERT INTO child_day_limits (child_id, weekday, daily_limit) VALUES ($1, $2, $3)`,
        [childId, d.weekday, d.dailyLimit]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getDayLimits, getDayLimitsForChildren, setDayLimits };
