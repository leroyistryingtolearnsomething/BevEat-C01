// Model: the parent's side of ask_mum_requests (CB69-26, migration 006).
// The kid side (asking) is Raghav's raghav/models/askMumModel.js.
const pool = require("../../config/db");

const TODAY = `(now() AT TIME ZONE 'Asia/Singapore')::date`;

// Everything one request card needs: the dish, its stall, the kid's name and the facts that say
// which of Mum's rules it breaks
const REQUEST_SELECT = `
  SELECT r.request_id, r.child_id, u.display_name AS child_name, r.item_id, m.name AS dish_name,
         s.name AS stall_name, s.cuisine AS stall_cuisine, m.price, m.default_image_url, m.is_fried, m.is_low_sugar, m.sugar_g,
         r.status, r.child_note, r.parent_note, r.changes, r.created_at, r.decided_at
    FROM ask_mum_requests r
    JOIN child_profiles c ON c.child_id = r.child_id
    JOIN users u ON u.user_id = r.child_id
    JOIN menu_items m ON m.item_id = r.item_id
    JOIN stalls s ON s.stall_id = m.stall_id`;

// Today's requests for one kid, newest first. status = 'pending' | 'approved' | 'denied' | null (all)
async function listTodayForChild(childId, status) {
  const { rows } = await pool.query(
    `${REQUEST_SELECT}
      WHERE r.child_id = $1 AND r.request_date = ${TODAY} AND ($2::text IS NULL OR r.status = $2)
      ORDER BY r.created_at DESC`,
    [childId, status ?? null]
  );
  return rows;
}

// The bell: today's pending requests from ALL of this parent's kids, newest first
async function listPendingForParent(parentId) {
  const { rows } = await pool.query(
    `${REQUEST_SELECT}
      WHERE c.parent_id = $1 AND r.request_date = ${TODAY} AND r.status = 'pending'
      ORDER BY r.created_at DESC`,
    [parentId]
  );
  return rows;
}

// One request, only if it belongs to one of this parent's kids (else undefined)
async function findForParent(requestId, parentId) {
  const { rows } = await pool.query(`${REQUEST_SELECT} WHERE r.request_id = $1 AND c.parent_id = $2`, [
    requestId,
    parentId,
  ]);
  return rows[0];
}

// Approve or deny. Only changes a row that is still pending, from today, and belongs to this
// parent's kid (docs/api-contracts.md §2f), so a double tap or an old screen can't flip a decision.
// changes = Mum's chips ("Less salt"), only kept on a yes (migration 008, CB69-74).
// Returns the updated row, or undefined if nothing matched.
async function decide(requestId, parentId, status, note, changes = []) {
  const { rows } = await pool.query(
    `UPDATE ask_mum_requests r
        SET status = $2, decided_at = now(), parent_note = $4, changes = $5
       FROM child_profiles c
      WHERE r.request_id = $1
        AND r.status = 'pending'
        AND r.request_date = ${TODAY}
        AND c.child_id = r.child_id
        AND c.parent_id = $3
  RETURNING r.request_id, r.status, r.decided_at, r.parent_note, r.changes`,
    [requestId, status, parentId, note, status === "approved" ? changes : []]
  );
  return rows[0];
}

module.exports = { listTodayForChild, listPendingForParent, findForParent, decide };
