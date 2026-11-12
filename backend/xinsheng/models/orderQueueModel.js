// Model: orders queue (live queue + order ready ping)
// an order is still in the queue until ready_at is set
const pool = require("../../config/db");

// only today's orders (Singapore time), old ones never marked ready shouldn't block the queue
const TODAY = `o.placed_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore'`;
const IN_QUEUE = `o.ready_at IS NULL AND o.collected_at IS NULL AND o.status <> 'cancelled' AND ${TODAY}`;

async function getOrder(orderId) {
  const { rows } = await pool.query(
    `SELECT o.order_id, o.child_id, o.stall_id, o.queue_number, o.status, o.placed_at,
            o.ready_at, o.collected_at, o.pickup_code, s.name AS stall_name, s.owner_id, s.avg_prep_minutes,
            c.parent_id
     FROM orders o
     JOIN stalls s ON s.stall_id = o.stall_id
     JOIN child_profiles c ON c.child_id = o.child_id
     WHERE o.order_id = $1`,
    [orderId]
  );
  return rows[0];
}

// orders at the same stall placed before this one that are still waiting
async function countAhead(stallId, placedAt, orderId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS ahead FROM orders o
     WHERE o.stall_id = $1 AND ${IN_QUEUE}
       AND (o.placed_at < $2 OR (o.placed_at = $2 AND o.order_id < $3))`,
    [stallId, placedAt, orderId]
  );
  return rows[0].ahead;
}

async function getStallQueue(stallId) {
  const { rows } = await pool.query(
    `SELECT s.stall_id, s.name, s.avg_prep_minutes,
            (SELECT COUNT(*)::int FROM orders o WHERE o.stall_id = s.stall_id AND ${IN_QUEUE}) AS in_queue
     FROM stalls s WHERE s.stall_id = $1`,
    [stallId]
  );
  return rows[0];
}

// kid's orders that are ready but not picked up yet
async function getReadyForChild(childId) {
  const { rows } = await pool.query(
    `SELECT o.order_id, o.queue_number, o.ready_at, o.pickup_code, s.name AS stall_name
     FROM orders o JOIN stalls s ON s.stall_id = o.stall_id
     WHERE o.child_id = $1 AND o.ready_at IS NOT NULL AND o.collected_at IS NULL
       AND o.status <> 'cancelled'
     ORDER BY o.ready_at`,
    [childId]
  );
  return rows;
}

// kid's orders today that aren't picked up yet (for the card on kid home)
async function getActiveForChild(childId) {
  const { rows } = await pool.query(
    `SELECT o.order_id, o.stall_id, o.queue_number, o.placed_at, o.ready_at, o.pickup_code,
            s.name AS stall_name, s.avg_prep_minutes
     FROM orders o JOIN stalls s ON s.stall_id = o.stall_id
     WHERE o.child_id = $1 AND o.collected_at IS NULL AND o.status <> 'cancelled' AND ${TODAY}
     ORDER BY o.placed_at`,
    [childId]
  );
  return rows;
}

// stall owner's screen: waiting orders first, then ready ones
async function getForOwner(ownerId) {
  const { rows } = await pool.query(
    `SELECT o.order_id, o.queue_number, o.status, o.placed_at, o.ready_at, s.stall_id, s.name AS stall_name
     FROM orders o JOIN stalls s ON s.stall_id = o.stall_id
     WHERE s.owner_id = $1 AND o.collected_at IS NULL AND o.status <> 'cancelled'
     ORDER BY (o.ready_at IS NOT NULL), o.placed_at`,
    [ownerId]
  );
  return rows;
}

// pickup code is made when the order is ready, kid shows it at the stall
async function markReady(orderId, pickupCode) {
  const { rows } = await pool.query(
    `UPDATE orders SET status = 'ready', ready_at = now(), pickup_code = $2
     WHERE order_id = $1 AND ready_at IS NULL RETURNING order_id, ready_at`,
    [orderId, pickupCode]
  );
  return rows[0];
}

async function markCollected(orderId) {
  const { rows } = await pool.query(
    `UPDATE orders SET status = 'collected', collected_at = now()
     WHERE order_id = $1 AND ready_at IS NOT NULL AND collected_at IS NULL RETURNING order_id, collected_at`,
    [orderId]
  );
  return rows[0];
}

module.exports = { getOrder, countAhead, getStallQueue, getReadyForChild, getActiveForChild, getForOwner, markReady, markCollected };
