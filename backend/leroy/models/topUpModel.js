// Model: top_ups table, and crediting child_profiles.wallet_balance
const pool = require("../../config/db");

async function createPending(parentId, childId, amount, netsTxnRef) {
  const { rows } = await pool.query(
    `INSERT INTO top_ups (parent_id, child_id, amount, nets_txn_ref)
     VALUES ($1, $2, $3, $4)
     RETURNING top_up_id, amount, status`,
    [parentId, childId, amount, netsTxnRef]
  );
  return rows[0];
}

// only the parent who made the top-up can see it
async function findForParent(topUpId, parentId) {
  const { rows } = await pool.query(
    `SELECT top_up_id, child_id, amount, status, nets_txn_ref, created_at
       FROM top_ups
      WHERE top_up_id = $1 AND parent_id = $2`,
    [topUpId, parentId]
  );
  return rows[0];
}

// one statement, so the wallet is credited at most once even if two status checks run together
async function markSuccess(topUpId) {
  const { rows } = await pool.query(
    `WITH done AS (
       UPDATE top_ups SET status = 'success', completed_at = now()
        WHERE top_up_id = $1 AND status = 'pending'
        RETURNING child_id, amount
     )
     UPDATE child_profiles c SET wallet_balance = c.wallet_balance + done.amount
       FROM done
      WHERE c.child_id = done.child_id
     RETURNING c.wallet_balance`,
    [topUpId]
  );
  return rows[0];
}

async function markFailed(topUpId) {
  await pool.query(`UPDATE top_ups SET status = 'failed' WHERE top_up_id = $1 AND status = 'pending'`, [
    topUpId,
  ]);
}

module.exports = { createPending, findForParent, markSuccess, markFailed };
