// NETS QR top-up tests
// Uses a fake in-memory database and a fake NETS API, so no Supabase or NETS connection is needed.
// Run with: npm test

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database
process.env.NETS_API_KEY = "test-key";
process.env.NETS_PROJECT_ID = "test-project";
process.env.NETS_TXN_ID = "sandbox_nets|m|test";

const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const childProfiles = [{ child_id: 10, parent_id: 1, wallet_balance: 5, display_name: "Ethan", avatar_emoji: "🐻", daily_limit: "5.00", allergens: ["Peanuts"], spent_today: "3.50" }];
const topUps = [];

// ---------- fake database ----------

function fakeQuery(sql, params = []) {
  if (sql.includes("JOIN users")) return { rows: childProfiles.filter((c) => c.parent_id === params[0]) };

  if (sql.includes("FROM child_profiles")) {
    const [childId, parentId] = params;
    return { rows: childProfiles.filter((c) => c.child_id === childId && c.parent_id === parentId) };
  }

  if (sql.includes("INSERT INTO top_ups")) {
    const [parent_id, child_id, amount, nets_txn_ref] = params;
    const row = { top_up_id: topUps.length + 1, parent_id, child_id, amount, nets_txn_ref, status: "pending", created_at: new Date() };
    topUps.push(row);
    return { rows: [row] };
  }

  if (sql.includes("FROM top_ups")) {
    const [topUpId, parentId] = params;
    return { rows: topUps.filter((t) => t.top_up_id === topUpId && t.parent_id === parentId) };
  }

  if (sql.includes("WITH done")) {
    const t = topUps.find((t) => t.top_up_id === params[0] && t.status === "pending");
    if (!t) return { rows: [] };
    t.status = "success";
    const child = childProfiles.find((c) => c.child_id === t.child_id);
    child.wallet_balance += Number(t.amount);
    return { rows: [{ wallet_balance: child.wallet_balance }] };
  }

  if (sql.includes("SET status = 'failed'")) {
    const t = topUps.find((t) => t.top_up_id === params[0] && t.status === "pending");
    if (t) t.status = "failed";
    return { rows: [] };
  }

  return { rows: [] };
}

const fakePool = { query: async (sql, params) => fakeQuery(sql, params) };

// swap the real db.js for the fake one before the app loads
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

// ---------- fake NETS ----------

const nets = { requestCode: "00", paid: false, calls: [] };
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  nets.calls.push({ url, headers: opts.headers, body });
  const data = url.endsWith("/request")
    ? { response_code: nets.requestCode, txn_status: nets.requestCode === "00" ? 1 : 2, qr_code: "QRBASE64", txn_retrieval_ref: "ref-" + nets.calls.length, instruction: "" }
    : { response_code: nets.paid ? "00" : "09", txn_status: nets.paid ? 1 : 0 };
  return { ok: true, json: async () => ({ result: { data } }) };
};

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent1 = tokenFor(1, "parent"); // kid 10's parent
const parent2 = tokenFor(2, "parent"); // someone else's parent
const kid = tokenFor(10, "child");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const topUp = (token, amount, childId = 10) => {
  const req = request(app).post(`/api/children/${childId}/top-ups`).send({ amount });
  return token ? req.set("Authorization", token) : req;
};
const status = (token, id) => request(app).get(`/api/top-ups/${id}`).set("Authorization", token);
const wallet = () => childProfiles[0].wallet_balance;

// ---------- tests ----------

async function run() {
  let res;

  // listing the parent's kids
  res = await request(app).get("/api/children").set("Authorization", parent1);
  check(res.status === 200 && res.body.children.length === 1 && res.body.children[0].walletBalance === 5 && res.body.children[0].name === "Ethan" && res.body.children[0].spentToday === 3.5 && res.body.children[0].allergens.join() === "peanut", "parent sees their kid, wallet, spent today and allergies");
  res = await request(app).get("/api/children").set("Authorization", parent2);
  check(res.status === 200 && res.body.children.length === 0, "another parent does not see the kid");
  check((await request(app).get("/api/children").set("Authorization", kid)).status === 403, "kid cannot list children");

  // making the QR code
  res = await topUp(parent1, 10);
  const id = res.body.topUpId;
  check(res.status === 201 && res.body.qrCode === "data:image/png;base64,QRBASE64" && res.body.status === "pending", "parent gets a QR code for their kid");
  const sent = nets.calls[0];
  check(sent.body.amt_in_dollars === 10 && sent.headers["api-key"] === "test-key", "NETS gets the amount and the API key");
  check(topUps[0].nets_txn_ref === "ref-1", "top-up saves the NETS retrieval ref");
  check(wallet() === 5, "wallet is not credited before paying");

  for (const bad of [0, "abc", 500, 10.555, -5, null])
    check((await topUp(parent1, bad)).status === 400, `amount ${JSON.stringify(bad)} is rejected`);

  check((await topUp(parent2, 10)).status === 404, "another parent cannot top up the kid");
  check((await topUp(kid, 10)).status === 403, "kid cannot top up");
  check((await topUp(null, 10)).status === 401, "not logged in is rejected");

  nets.requestCode = "68";
  const before = topUps.length;
  res = await topUp(parent1, 10);
  check(res.status === 502 && topUps.length === before, "NETS error gives 502 and saves nothing");
  nets.requestCode = "00";

  // checking the status
  res = await status(parent1, id);
  check(res.status === 200 && res.body.status === "pending" && wallet() === 5, "unpaid top-up stays pending");

  nets.paid = true;
  res = await status(parent1, id);
  check(res.body.status === "success" && wallet() === 15, "paid top-up credits the wallet");

  res = await status(parent1, id);
  check(res.body.status === "success" && wallet() === 15, "checking again does not credit twice");

  check((await status(parent2, id)).status === 404, "another parent cannot see the top-up");
  check((await status(parent1, "abc")).status === 400, "bad top-up id is rejected");

  // QR code expired without paying
  nets.paid = false;
  res = await topUp(parent1, 20);
  topUps.at(-1).created_at = new Date(Date.now() - 6 * 60 * 1000);
  res = await status(parent1, res.body.topUpId);
  check(res.body.status === "failed" && wallet() === 15, "expired unpaid top-up fails");
  check(nets.calls.at(-1).body.frontend_timeout_status === 1, "NETS is told the QR timed out");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
