// Model: ask_mum_requests (Leslie's table, docs/schema-requests.md #9). SQL only, returns plain rows.
// Raghav's API only INSERTs pending requests and reads them. Leslie's parent side does the
// approve / deny UPDATE (docs/api-contracts.md §2f).
const pool = require("../../config/db");

// "Today" is the Singapore calendar day, worked out by Postgres. It's the same expression as the
// request_date column default, so a request made at 11:59pm and the check at 12:01am both use
// the database's clock and can never disagree with the server's time zone.
const SG_TODAY = `(now() AT TIME ZONE 'Asia/Singapore')::date`;

// child_note = the kid's optional note for Mum (schema request #11). Leslie's parent screens show it.
const REQUEST_COLUMNS = `request_id, child_id, item_id, status, child_note, created_at, decided_at`;

// This child's request about this dish today, or undefined. The unique index
// ask_mum_one_per_day means there is at most one.
async function findToday(childId, itemId) {
  const { rows } = await pool.query(
    `SELECT ${REQUEST_COLUMNS}
       FROM ask_mum_requests
      WHERE child_id = $1 AND item_id = $2 AND request_date = ${SG_TODAY}`,
    [childId, itemId]
  );
  return rows[0];
}

// A new pending request. status, request_date and created_at come from the column defaults.
// If the child already asked about this dish today, the unique index ask_mum_one_per_day makes
// Postgres throw error code 23505, which the controller turns into "here's your existing request".
// note: already checked by parseAskMumNote (trimmed, <= 100 characters), or null for "no note".
// The table's CHECK on child_note is a second guard.
async function create(childId, itemId, note = null) {
  const { rows } = await pool.query(
    `INSERT INTO ask_mum_requests (child_id, item_id, child_note)
     VALUES ($1, $2, $3)
     RETURNING ${REQUEST_COLUMNS}`,
    [childId, itemId, note]
  );
  return rows[0];
}

// Dishes Mum said yes to TODAY. Yesterday's yes doesn't count ("just this once").
// A database error THROWS, so the menu fails with a 500 rather than guessing.
async function approvedItemIdsToday(childId) {
  const { rows } = await pool.query(
    `SELECT item_id
       FROM ask_mum_requests
      WHERE child_id = $1 AND status = 'approved' AND request_date = ${SG_TODAY}`,
    [childId]
  );
  return rows.map((r) => r.item_id);
}

// Same as above, plus what Mum asked for when she said yes (Leslie, CB69-74, migration 008):
// [{ itemId, changes: ["Less salt"], parentNote }]. Used by the menu (kid sees tags) and checkout
// (the changes go on the order ticket).
async function approvedToday(childId) {
  const { rows } = await pool.query(
    `SELECT item_id, changes, parent_note FROM ask_mum_requests
      WHERE child_id = $1 AND status = 'approved' AND request_date = ${SG_TODAY}`,
    [childId]
  );
  return rows.map((r) => ({ itemId: r.item_id, changes: r.changes || [], parentNote: r.parent_note || null }));
}

module.exports = { findToday, create, approvedItemIdsToday, approvedToday };
