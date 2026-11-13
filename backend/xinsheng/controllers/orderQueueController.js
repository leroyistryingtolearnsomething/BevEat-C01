// Live queue + wait time, and the order ready ping
const crypto = require("crypto");
const Queue = require("../models/orderQueueModel");

const DEFAULT_PREP_MIN = 5; // if the stall has no avg_prep_minutes
const HIDE_AFTER_MIN = 30; // cards + ping go away 30 min after ready (or 30 min after it should have been ready)
const minsAgo = (time) => (Date.now() - new Date(time).getTime()) / 60000;
const CODE_RE = /^\d{4}$/;

const newPickupCode = () => String(crypto.randomInt(0, 10000)).padStart(4, "0");

// kid / parent see the code once it's ready (stall owner doesn't, kid has to show it)
function pickupInfo(user, order) {
  if (user.role === "stall_owner" || !order.ready_at || order.collected_at || !order.pickup_code) return {};
  return { pickupCode: order.pickup_code };
}

const prepMins = (stall) => stall.avg_prep_minutes || DEFAULT_PREP_MIN;

// stage for the tracker: received (orders ahead) -> cooking (next up) -> ready -> collected
// readyBy = placed time + estimated wait, the app counts down to it
function queueInfo(order, ahead) {
  if (order.status === "cancelled") return { stage: "cancelled", ahead: 0, waitMinutes: 0, readyBy: null };
  if (order.collected_at) return { stage: "collected", ahead: 0, waitMinutes: 0, readyBy: null };
  if (order.ready_at) return { stage: "ready", ahead: 0, waitMinutes: 0, readyBy: null };
  const waitMinutes = (ahead + 1) * prepMins(order);
  const readyBy = new Date(new Date(order.placed_at).getTime() + waitMinutes * 60000).toISOString();
  return { stage: ahead > 0 ? "received" : "cooking", ahead, waitMinutes, readyBy };
}

function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// kid who ordered it, or that kid's parent
function canSee(user, order) {
  if (user.role === "child") return order.child_id === user.id;
  if (user.role === "parent") return order.parent_id === user.id;
  if (user.role === "stall_owner") return order.owner_id === user.id;
  return false;
}

// GET /api/orders/:orderId/queue
async function getOrderQueue(req, res, next) {
  const orderId = toId(req.params.orderId);
  if (!orderId) return res.status(400).json({ error: "Invalid order id" });
  try {
    const order = await Queue.getOrder(orderId);
    if (!order || !canSee(req.user, order)) return res.status(404).json({ error: "Order not found" });

    const waiting = !order.ready_at && !order.collected_at && order.status !== "cancelled";
    const ahead = waiting ? await Queue.countAhead(order.stall_id, order.placed_at, order.order_id) : 0;
    res.json({
      orderId: order.order_id,
      queueNumber: order.queue_number,
      stallName: order.stall_name,
      status: order.status,
      ready: !!order.ready_at,
      ...queueInfo(order, ahead),
      readyAt: order.ready_at,
      ...pickupInfo(req.user, order),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stalls/:stallId/wait  (shown on the stall card before ordering)
async function getStallWait(req, res, next) {
  const stallId = toId(req.params.stallId);
  if (!stallId) return res.status(400).json({ error: "Invalid stall id" });
  try {
    const stall = await Queue.getStallQueue(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found" });
    res.json({
      stallId: stall.stall_id,
      inQueue: stall.in_queue,
      waitMinutes: (stall.in_queue + 1) * prepMins(stall),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/me/ready-orders  (kid app checks this every few seconds for the ping)
async function getMyReadyOrders(req, res, next) {
  try {
    const rows = (await Queue.getReadyForChild(req.user.id)).filter((o) => minsAgo(o.ready_at) <= HIDE_AFTER_MIN);
    res.json({
      orders: rows.map((o) => ({
        orderId: o.order_id,
        queueNumber: o.queue_number,
        stallName: o.stall_name,
        readyAt: o.ready_at,
        ...pickupInfo(req.user, o),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// today's orders with their place in the queue (kid home + parent home cards)
async function withQueue(user, rows) {
  const orders = [];
  for (const o of rows) {
    const ahead = o.ready_at ? 0 : await Queue.countAhead(o.stall_id, o.placed_at, o.order_id);
    const info = queueInfo(o, ahead);
    // old orders nobody picked up shouldn't sit on the home cards all day
    if (minsAgo(o.ready_at || info.readyBy) > HIDE_AFTER_MIN) continue;
    orders.push({
      orderId: o.order_id,
      ...(o.child_name && { childId: o.child_id, childName: o.child_name }),
      queueNumber: o.queue_number,
      stallName: o.stall_name,
      ready: !!o.ready_at,
      ...info,
      ...pickupInfo(user, o),
    });
  }
  return orders;
}

// GET /api/me/orders  (kid)
async function getMyOrders(req, res, next) {
  try {
    res.json({ orders: await withQueue(req.user, await Queue.getActiveForChild(req.user.id)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/children/live-orders  (parent, all their kids)
async function getKidsOrders(req, res, next) {
  try {
    res.json({ orders: await withQueue(req.user, await Queue.getActiveForParent(req.user.id)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/stall/orders
async function getStallOrders(req, res, next) {
  try {
    const rows = await Queue.getForOwner(req.user.id);
    res.json({
      orders: rows.map((o) => ({
        orderId: o.order_id,
        queueNumber: o.queue_number,
        stallId: o.stall_id,
        stallName: o.stall_name,
        status: o.status,
        placedAt: o.placed_at,
        ready: !!o.ready_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// stall owner can only change orders at their own stall
async function ownOrder(req, res) {
  const orderId = toId(req.params.orderId);
  if (!orderId) {
    res.status(400).json({ error: "Invalid order id" });
    return null;
  }
  const order = await Queue.getOrder(orderId);
  if (!order || order.owner_id !== req.user.id) {
    res.status(404).json({ error: "Order not found" });
    return null;
  }
  return order;
}

// PUT /api/orders/:orderId/ready
async function markReady(req, res, next) {
  try {
    const order = await ownOrder(req, res);
    if (!order) return;
    if (order.status === "cancelled") return res.status(409).json({ error: "Order was cancelled" });
    const row = await Queue.markReady(order.order_id, newPickupCode());
    if (!row) return res.status(409).json({ error: "Order is already ready" });
    res.json({ orderId: row.order_id, readyAt: row.ready_at });
  } catch (err) {
    next(err);
  }
}

// PUT /api/orders/:orderId/collected  body { code }  (stall types in the kid's code)
async function markCollected(req, res, next) {
  const { code } = req.body || {};
  if (typeof code !== "string" || !CODE_RE.test(code))
    return res.status(400).json({ error: "Enter the 4 digit pickup code" });
  try {
    const order = await ownOrder(req, res);
    if (!order) return;
    // orders marked ready before pickup codes existed have no code
    if (order.ready_at && order.pickup_code && order.pickup_code !== code)
      return res.status(400).json({ error: "Wrong pickup code" });
    const row = await Queue.markCollected(order.order_id);
    if (!row) return res.status(409).json({ error: "Order is not ready yet or already collected" });
    res.json({ orderId: row.order_id, collectedAt: row.collected_at });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOrderQueue, getStallWait, getMyReadyOrders, getMyOrders, getKidsOrders, getStallOrders, markReady, markCollected };
