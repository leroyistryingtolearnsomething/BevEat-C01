// Model: ask_mum_requests (migration 006, docs/schema-requests.md #9).
// Kid side (Raghav): findToday, create, approvedItemIdsToday. Parent side (Leslie, CB69-26) lives in
// leslie/models/askMumParentModel.js. Rows come back as plain pg rows (snake_case).
//
// The tests set ASK_MUM_MEMORY=1 so they use the in-memory copy (askMumModel.memory.js) and need
// no database. Both files export the same functions with the same row shapes.
if (process.env.ASK_MUM_MEMORY === "1") {
  module.exports = require("./askMumModel.memory");
} else {
  const pool = require("../../config/db");

  // "today" is always the Singapore calendar day, worked out by Postgres so it matches request_date
  const TODAY = `(now() AT TIME ZONE 'Asia/Singapore')::date`;
  const COLUMNS = `request_id, child_id, item_id, status, to_char(request_date, 'YYYY-MM-DD') AS request_date,
                   parent_note, created_at, decided_at`;

  // "YYYY-MM-DD" for the current day in Singapore (en-CA formats dates that way)
  const singaporeToday = (now = new Date()) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);

  async function findToday(childId, itemId) {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM ask_mum_requests WHERE child_id = $1 AND item_id = $2 AND request_date = ${TODAY}`,
      [childId, itemId]
    );
    return rows[0];
  }

  // A second request for the same dish today breaks the unique index: pg throws code 23505,
  // which the controller already handles
  async function create(childId, itemId) {
    const { rows } = await pool.query(
      `INSERT INTO ask_mum_requests (child_id, item_id) VALUES ($1, $2) RETURNING ${COLUMNS}`,
      [childId, itemId]
    );
    return rows[0];
  }

  // Dishes Mum said yes to TODAY. Yesterday's yes doesn't count ("just this once").
  async function approvedItemIdsToday(childId) {
    const { rows } = await pool.query(
      `SELECT item_id FROM ask_mum_requests WHERE child_id = $1 AND status = 'approved' AND request_date = ${TODAY}`,
      [childId]
    );
    return rows.map((r) => r.item_id);
  }

  module.exports = { findToday, create, approvedItemIdsToday, singaporeToday };
}
