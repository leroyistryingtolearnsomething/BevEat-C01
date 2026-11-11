// Live queue + order ready ping tests
// fake in-memory database, no Supabase needed

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database

const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

// users: 1 parent, 2 other parent, 10 + 12 kids, 20 + 21 stall owners
const childProfiles = [
  { child_id: 10, parent_id: 1 },
  { child_id: 12, parent_id: 2 },
];
const stalls = [
  { stall_id: 1, name: "Ah Hock Chicken Rice", owner_id: 20, avg_prep_minutes: 4 },
  { stall_id: 2, name: "Mee Pok Man", owner_id: 21, avg_prep_minutes: null },
];
const t = (min) => new Date(Date.UTC(2026, 10, 6, 4, min));
const orders = [
  { order_id: 1, child_id: 12, stall_id: 1, queue_number: 101, status: "placed", placed_at: t(0), ready_at: null, collected_at: null },
  { order_id: 2, child_id: 12, stall_id: 1, queue_number: 102, status: "placed", placed_at: t(1), ready_at: null, collected_at: null },
  { order_id: 3, child_id: 10, stall_id: 1, queue_number: 103, status: "placed", placed_at: t(2), ready_at: null, collected_at: null },
  { order_id: 4, child_id: 10, stall_id: 2, queue_number: 201, status: "cancelled", placed_at: t(0), ready_at: null, collected_at: null },
];

// ---------- fake database ----------

const inQueue = (o) => !o.ready_at && !o.collected_at && o.status !== "cancelled";
const stallOf = (o) => stalls.find((s) => s.stall_id === o.stall_id);

function fakeQuery(sql, params = []) {
  if (sql.includes("WHERE o.order_id = $1")) {
    const o = orders.find((x) => x.order_id === params[0]);
    if (!o) return { rows: [] };
    const s = stallOf(o);
    const c = childProfiles.find((x) => x.child_id === o.child_id);
    return {
      rows: [{ ...o, stall_name: s.name, owner_id: s.owner_id, avg_prep_minutes: s.avg_prep_minutes, parent_id: c.parent_id }],
    };
  }

  if (sql.includes("AS ahead")) {
    const [stallId, placedAt, orderId] = params;
    const ahead = orders.filter(
      (o) => o.stall_id === stallId && inQueue(o) &&
        (o.placed_at < placedAt || (+o.placed_at === +placedAt && o.order_id < orderId))
    ).length;
    return { rows: [{ ahead }] };
  }

  if (sql.includes("AS in_queue")) {
    const s = stalls.find((x) => x.stall_id === params[0]);
    if (!s) return { rows: [] };
    const in_queue = orders.filter((o) => o.stall_id === s.stall_id && inQueue(o)).length;
    return { rows: [{ ...s, in_queue }] };
  }

  if (sql.includes("WHERE o.child_id = $1 AND o.ready_at IS NOT NULL")) {
    return {
      rows: orders
        .filter((o) => o.child_id === params[0] && o.ready_at && !o.collected_at && o.status !== "cancelled")
        .map((o) => ({ ...o, stall_name: stallOf(o).name })),
    };
  }

  if (sql.includes("WHERE s.owner_id = $1")) {
    return {
      rows: orders
        .filter((o) => stallOf(o).owner_id === params[0] && !o.collected_at && o.status !== "cancelled")
        .map((o) => ({ ...o, stall_name: stallOf(o).name })),
    };
  }

  if (sql.includes("SET status = 'ready'")) {
    const o = orders.find((x) => x.order_id === params[0] && !x.ready_at);
    if (!o) return { rows: [] };
    o.status = "ready";
    o.ready_at = new Date();
    o.pickup_code = params[1];
    return { rows: [o] };
  }

  if (sql.includes("SET status = 'collected'")) {
    const o = orders.find((x) => x.order_id === params[0] && x.ready_at && !x.collected_at);
    if (!o) return { rows: [] };
    o.status = "collected";
    o.collected_at = new Date();
    return { rows: [o] };
  }

  return { rows: [] };
}

const fakePool = {
  query: async (sql, params) => fakeQuery(sql, params),
  connect: async () => ({ query: async (sql, params) => fakeQuery(sql, params), release() {} }),
};

const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const kid = tokenFor(10, "child");
const otherKid = tokenFor(12, "child");
const parent = tokenFor(1, "parent");
const otherParent = tokenFor(2, "parent");
const owner = tokenFor(20, "stall_owner");
const otherOwner = tokenFor(21, "stall_owner");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const get = (path, token) => {
  const r = request(app).get("/api" + path);
  return token ? r.set("Authorization", token) : r;
};
const put = (path, token) => {
  const r = request(app).put("/api" + path);
  return token ? r.set("Authorization", token) : r;
};

// ---------- tests ----------

async function run() {
  let res;

  // live queue
  res = await get("/orders/3/queue", kid);
  check(res.status === 200 && res.body.ahead === 2, "kid sees 2 orders ahead");
  check(res.body.waitMinutes === 12, "wait time = (ahead + 1) x stall prep time");
  check(res.body.queueNumber === 103 && res.body.ready === false, "shows queue number, not ready yet");

  res = await get("/orders/3/queue", parent);
  check(res.status === 200, "parent can see their kid's order");

  res = await get("/orders/3/queue", otherParent);
  check(res.status === 404, "other parent cannot see the order");

  res = await get("/orders/3/queue", otherKid);
  check(res.status === 404, "other kid cannot see the order");

  res = await get("/orders/3/queue");
  check(res.status === 401, "not logged in is rejected");

  res = await get("/orders/abc/queue", kid);
  check(res.status === 400, "bad order id is rejected");

  res = await get("/orders/99/queue", kid);
  check(res.status === 404, "unknown order is 404");

  res = await get("/orders/4/queue", kid);
  check(res.status === 200 && res.body.waitMinutes === 0, "cancelled order has no wait");

  // stall wait time
  res = await get("/stalls/1/wait", kid);
  check(res.status === 200 && res.body.inQueue === 3 && res.body.waitMinutes === 16, "stall shows queue length and wait");

  res = await get("/stalls/2/wait", kid);
  check(res.body.inQueue === 0 && res.body.waitMinutes === 5, "cancelled orders don't count, default 5 min prep");

  res = await get("/stalls/9/wait", kid);
  check(res.status === 404, "unknown stall is 404");

  // stall owner marks orders ready
  res = await get("/stall/orders", owner);
  check(res.status === 200 && res.body.orders.length === 3, "stall owner sees their orders");

  res = await get("/stall/orders", kid);
  check(res.status === 403, "kid cannot see the stall's orders");

  res = await put("/orders/3/ready", otherOwner);
  check(res.status === 404, "other stall cannot mark the order ready");

  res = await put("/orders/3/ready", kid);
  check(res.status === 403, "kid cannot mark an order ready");

  res = await get("/me/ready-orders", kid);
  check(res.status === 200 && res.body.orders.length === 0, "no ping before it's ready");

  res = await put("/orders/1/ready", owner);
  check(res.status === 200 && res.body.readyAt, "stall owner marks an order ready");

  res = await put("/orders/1/ready", owner);
  check(res.status === 409, "can't mark ready twice");

  res = await get("/orders/3/queue", kid);
  check(res.body.ahead === 1 && res.body.waitMinutes === 8, "queue moves up when an order is ready");

  res = await put("/orders/3/collected", owner).send({ code: "0000" });
  check(res.status === 409, "can't collect before it's ready");

  res = await get("/orders/3/queue", kid);
  check(res.body.pickupCode === undefined, "no pickup code before it's ready");

  res = await put("/orders/3/ready", owner);
  res = await get("/me/ready-orders", kid);
  check(
    res.status === 200 && res.body.orders.length === 1 && res.body.orders[0].queueNumber === 103,
    "kid gets the ready ping"
  );
  const code = res.body.orders[0].pickupCode;
  check(/^\d{4}$/.test(code), "ready ping has a 4 digit pickup code");

  res = await get("/orders/3/queue", parent);
  check(res.body.pickupCode === code, "parent can see the pickup code too");

  res = await get("/orders/3/queue", owner);
  check(res.status === 200 && res.body.pickupCode === undefined, "stall owner doesn't get the code");

  res = await get("/me/ready-orders", parent);
  check(res.status === 403, "ready ping is only for kids");

  res = await put("/orders/4/ready", otherOwner);
  check(res.status === 409, "cancelled order can't be marked ready");

  res = await put("/orders/3/collected", owner);
  check(res.status === 400, "collecting needs the code");

  const wrong = code === "1111" ? "2222" : "1111";
  res = await put("/orders/3/collected", owner).send({ code: wrong });
  check(res.status === 400, "wrong pickup code is rejected");

  res = await put("/orders/3/collected", otherOwner).send({ code });
  check(res.status === 404, "other stall can't collect it even with the code");

  res = await put("/orders/3/collected", owner).send({ code });
  check(res.status === 200, "stall owner marks it collected with the right code");

  res = await get("/orders/3/queue", kid);
  check(res.body.pickupCode === undefined, "code is gone after it's collected");

  res = await get("/me/ready-orders", kid);
  check(res.body.orders.length === 0, "ping stops after it's collected");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
