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

module.exports = { getDailySpend };
