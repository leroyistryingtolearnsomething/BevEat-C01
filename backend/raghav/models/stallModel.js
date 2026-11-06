// Model: stalls table (stall discovery). SQL only, returns plain rows.
const pool = require("../../config/db");

const STALL_COLUMNS = `stall_id, name, unit_no, cuisine, is_halal, description, year_started,
       is_open, avg_prep_minutes, cover_image_url`;

// cuisine: exact cuisine name or null. halalOnly: true or null.
// null means "don't filter", so ONE fixed query handles every filter combination
// and user input only ever travels as a $ parameter, never inside the SQL text.
async function listStalls(cuisine, halalOnly) {
  const { rows } = await pool.query(
    `SELECT ${STALL_COLUMNS}
     FROM stalls
     WHERE ($1::text IS NULL OR cuisine = $1)
       AND ($2::boolean IS NULL OR is_halal = $2)
     ORDER BY is_open DESC, name`,
    [cuisine, halalOnly]
  );
  return rows; // open stalls first, then A-Z
}

async function getStallById(stallId) {
  const { rows } = await pool.query(
    `SELECT ${STALL_COLUMNS} FROM stalls WHERE stall_id = $1`,
    [stallId]
  );
  return rows[0]; // undefined if there is no such stall
}

module.exports = { listStalls, getStallById };
