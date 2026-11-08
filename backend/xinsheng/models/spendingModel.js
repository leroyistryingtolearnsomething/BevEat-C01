// Model: food money spent per day (orders table), Singapore days, cancelled orders don't count
const pool = require("../../config/db");

// last `days` days including today, days with no orders come back as 0
async function getDailySpend(childId, days) {
  const { rows } = await pool.query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(o.total_amount), 0) AS spent
       FROM generate_series((now() AT TIME ZONE 'Asia/Singapore')::date - ($2::int - 1),
                            (now() AT TIME ZONE 'Asia/Singapore')::date, interval '1 day') AS d
       LEFT JOIN orders o ON o.child_id = $1 AND o.status <> 'cancelled'
            AND (o.placed_at AT TIME ZONE 'Asia/Singapore')::date = d::date
      GROUP BY d
      ORDER BY d`,
    [childId, days]
  );
  return rows;
}

// every saved change to the kid's limits, oldest first (filled by triggers, see db/schema_requests.sql)
async function getLimitHistory(childId) {
  try {
    const { rows } = await pool.query(
      `SELECT changed_at, daily_limit, day_limits FROM child_limit_history
        WHERE child_id = $1 ORDER BY changed_at, id`,
      [childId]
    );
    return rows;
  } catch (err) {
    // table not made yet, report just uses the current limits
    if (err.code === "42P01") return [];
    throw err;
  }
}

module.exports = { getDailySpend, getLimitHistory };
