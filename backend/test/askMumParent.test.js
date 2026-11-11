// Ask Mum parent side (CB69-26) + Mum's rules switches (CB69-18), Leslie.
// Runs the REAL Ask Mum model (raghav/models/askMumModel.js) against Raghav's fake menu database,
// with ask_mum_requests, child_food_rules and child_profiles added on top. No Supabase needed.
// Run with: npm test   (or just this file: node test/askMumParent.test.js)

process.env.JWT_SECRET = "test-secret";
delete process.env.ASK_MUM_MEMORY; // this file tests the real SQL model

const jwt = require("jsonwebtoken");
const request = require("supertest");
const db = require("./fixtures/raghavMenuDb");
const { isSugary } = require("../raghav/services/dishSafety");

db.install();
const fakePool = require.cache[require.resolve("../config/db")].exports;
const menuQuery = fakePool.query;

// ---------- extra fake tables ----------
const PARENT_A = 1; // Ethan (3) and Aisyah (5)
const PARENT_B = 2; // Chloe (4)
const parentOf = { 3: PARENT_A, 5: PARENT_A, 4: PARENT_B };
const AISYAH = 5; // no allergies, S$6 a day
const ETHAN = 3; // allergic to peanuts + shellfish

// is_fried / sugar_g from the live menu after migration 006
const FRIED = new Set([4, 5, 17, 21, 25, 26, 28]);
const SUGAR = { 10: 26, 11: 35, 12: 24, 22: 14, 23: 20, 24: 50 };
const withFacts = (row) => ({ ...row, is_fried: FRIED.has(row.item_id), is_low_sugar: false, sugar_g: String(SUGAR[row.item_id] ?? 4) });

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
let rules = []; // { child_id, rule_type, item_id }
let asks = []; // ask_mum_requests rows
let nextAsk = 1;

const askRow = (r) => {
  const d = db.dishes.find((x) => x.item_id === r.item_id);
  return {
    ...r, child_name: db.children[r.child_id].name, dish_name: d.name, price: d.price, default_image_url: null,
    stall_name: db.stalls.find((s) => s.stall_id === d.stall_id).name,
    is_fried: FRIED.has(r.item_id), is_low_sugar: false, sugar_g: String(SUGAR[r.item_id] ?? 4),
  };
};

fakePool.query = async (sql, params = []) => {
  const [p1, p2, p3, p4] = params;
  if (sql.includes("FROM child_profiles WHERE child_id = $1 AND parent_id = $2"))
    return { rows: parentOf[p1] === p2 ? [{ child_id: p1 }] : [] };

  // Mum's rules
  if (sql.includes("rule_type = ANY")) return { rows: rules.filter((r) => r.child_id === p1 && p2.includes(r.rule_type)) };
  if (sql.includes("INSERT INTO child_food_rules")) {
    if (!rules.some((r) => r.child_id === p1 && r.rule_type === p2)) rules.push({ child_id: p1, rule_type: p2, item_id: null });
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("DELETE FROM child_food_rules")) {
    rules = rules.filter((r) => !(r.child_id === p1 && r.rule_type === p2));
    return { rows: [] };
  }
  if (sql.includes("FROM child_food_rules r")) return { rows: rules.filter((r) => r.child_id === p1).map((r) => ({ ...r, name: null })) };

  // Ask Mum, kid side (Raghav's model)
  if (sql.includes("INSERT INTO ask_mum_requests")) {
    if (asks.some((a) => a.child_id === p1 && a.item_id === p2 && a.request_date === today())) {
      const err = new Error("duplicate key");
      err.code = "23505";
      throw err;
    }
    const row = { request_id: nextAsk++, child_id: p1, item_id: p2, status: "pending", request_date: today(), parent_note: null, created_at: new Date(), decided_at: null };
    asks.push(row);
    return { rows: [{ ...row }] };
  }
  if (sql.includes("SELECT item_id FROM ask_mum_requests"))
    return { rows: asks.filter((a) => a.child_id === p1 && a.status === "approved" && a.request_date === today()) };
  if (sql.includes("FROM ask_mum_requests WHERE child_id = $1 AND item_id = $2"))
    return { rows: asks.filter((a) => a.child_id === p1 && a.item_id === p2 && a.request_date === today()).map((a) => ({ ...a })) };

  // Ask Mum, parent side (Leslie's model)
  if (sql.includes("UPDATE ask_mum_requests r")) {
    const a = asks.find((x) => x.request_id === p1 && x.status === "pending" && x.request_date === today() && parentOf[x.child_id] === p3);
    if (!a) return { rows: [] };
    Object.assign(a, { status: p2, parent_note: p4, decided_at: new Date() });
    return { rows: [{ ...a }] };
  }
  if (sql.includes("FROM ask_mum_requests r")) {
    let rows = asks;
    if (sql.includes("r.request_id = $1")) rows = rows.filter((a) => a.request_id === p1 && parentOf[a.child_id] === p2);
    else if (sql.includes("c.parent_id = $1"))
      rows = rows.filter((a) => parentOf[a.child_id] === p1 && a.request_date === today() && a.status === "pending");
    else rows = rows.filter((a) => a.child_id === p1 && a.request_date === today() && (p2 === null || a.status === p2));
    return { rows: [...rows].reverse().map(askRow) };
  }

  // Gabriel's Home stall list and top pics: not what this file tests
  if (sql.includes("AS safe_picks") || sql.includes("SELECT * FROM(")) return { rows: [] };

  const res = await menuQuery(sql, params);
  return sql.includes("FROM menu_items m") ? { ...res, rows: res.rows.map(withFacts) } : res;
};

const app = require("../server");

const token = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const as = (id, role) => ({
  get: (url) => request(app).get(url).set("Authorization", token(id, role)),
  put: (url, body) => request(app).put(url).set("Authorization", token(id, role)).send(body),
  post: (url, body) => request(app).post(url).set("Authorization", token(id, role)).send(body),
});
const mumA = as(PARENT_A, "parent");
const mumB = as(PARENT_B, "parent");
const aisyah = as(AISYAH, "child");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}
const dishOn = async (stallId, itemId) =>
  (await aisyah.get(`/api/stalls/${stallId}/menu?view=all`)).body.dishes.find((d) => d.id === itemId);

async function run() {
  let res;

  // ----- isSugary -----
  check(isSugary({ sugarG: 26 }) && !isSugary({ sugarG: 14 }), "isSugary: 15 g or more is sugary");
  check(!isSugary({ sugarG: 30, isLowSugar: true }), "isSugary: a low-sugar dish never counts");
  check(isSugary({ sugarG: null }), "isSugary: unknown sugar fails closed");

  // ----- Mum's rules switches -----
  res = await mumA.get(`/api/children/${AISYAH}/food-rules`);
  check(res.status === 200 && res.body.noFried === false && res.body.noSugary === false, "rules start off");
  check((await mumB.get(`/api/children/${AISYAH}/food-rules`)).status === 404, "another parent can't see the rules (404)");
  check((await aisyah.get(`/api/children/${AISYAH}/food-rules`)).status === 403, "a kid can't read the rules (403)");
  check((await mumA.put(`/api/children/${AISYAH}/food-rules`, {})).status === 400, "PUT with nothing is 400");
  check((await mumA.put(`/api/children/${AISYAH}/food-rules`, { noFried: "yes" })).status === 400, "PUT non-boolean is 400");
  check((await mumB.put(`/api/children/${AISYAH}/food-rules`, { noFried: true })).status === 404, "another parent can't change them");

  check((await dishOn(2, 5)).status === "allowed", "before the rule, Mee Goreng is allowed");
  res = await mumA.put(`/api/children/${AISYAH}/food-rules`, { noFried: true, noSugary: true });
  check(res.status === 200 && res.body.noFried && res.body.noSugary, "turn on no fried + no sugary");

  let d = await dishOn(2, 5);
  check(d.status === "blocked_parent" && d.parentRule.label === "No fried food", "Mee Goreng locked: No fried food");
  check((await dishOn(2, 6)).status === "allowed", "Plain Nasi Lemak (not fried) still allowed");
  d = await dishOn(4, 10);
  check(d.status === "blocked_parent" && d.parentRule.label === "No sugary drinks", "Milo Ice (26 g) locked: No sugary drinks");
  check((await dishOn(4, 22)).status === "allowed", "Soya Bean Milk (14 g) still allowed");

  res = await aisyah.get("/api/home");
  const chips = res.body.rules.filter((r) => r.type === "parent").map((r) => r.label);
  check(res.status === 200 && chips.includes("fried food") && chips.includes("sugary drinks"), "kid Home shows the rules as chips");

  // ----- Ask Mum: kid asks, Mum sees it -----
  res = await aisyah.post("/api/ask-mum", { itemId: 5 });
  check(res.status === 201 && res.body.status === "pending", "Aisyah asks for Mee Goreng (pending)");
  const reqId = res.body.requestId;

  res = await mumA.get("/api/ask-mum/pending");
  const card = res.body.requests && res.body.requests[0];
  check(res.status === 200 && res.body.requests.length === 1, "Mum's bell has 1 request");
  check(card && card.dishName === "Mee Goreng" && card.childName === "Aisyah" && card.price === 3.5 && card.stallName === "Mariam Nasi Lemak",
    "request card has dish, kid, price and stall");
  check(card && card.ruleLabel === "No fried food", "request card says which rule it breaks");
  check((await mumB.get("/api/ask-mum/pending")).body.requests.length === 0, "another parent's bell is empty");
  res = await mumA.get(`/api/children/${AISYAH}/ask-mum?status=pending`);
  check(res.status === 200 && res.body.requests.length === 1, "per-kid list (api-contracts §2f) works");
  check((await mumA.get(`/api/children/${AISYAH}/ask-mum?status=maybe`)).status === 400, "bad status filter is 400");
  check((await mumA.get(`/api/ask-mum/requests/${reqId}`)).body.request.requestId === reqId, "parent can open one request");
  check((await mumB.get(`/api/ask-mum/requests/${reqId}`)).status === 404, "another parent can't open it (404)");

  // ----- deciding -----
  check((await aisyah.put(`/api/ask-mum/${reqId}`, { decision: "approved" })).status === 403, "a kid can't approve (403)");
  check((await mumA.put(`/api/ask-mum/${reqId}`, { decision: "maybe" })).status === 400, "decision must be approved/denied");
  check((await mumA.put(`/api/ask-mum/${reqId}`, { decision: "approved", note: "x".repeat(201) })).status === 400, "note over 200 chars is 400");
  check((await mumB.put(`/api/ask-mum/${reqId}`, { decision: "approved" })).status === 404, "another parent can't decide (404)");
  check((await mumA.put(`/api/ask-mum/999`, { decision: "approved" })).status === 404, "unknown request is 404");

  res = await mumA.put(`/api/ask-mum/${reqId}`, { decision: "approved", note: "  Okay! Eat some veg tonight " });
  check(res.status === 200 && res.body.status === "approved" && res.body.parentNote === "Okay! Eat some veg tonight", "Mum says yes, with a note");
  res = await mumA.put(`/api/ask-mum/${reqId}`, { decision: "denied" });
  check(res.status === 409, "deciding twice is 409");
  check((await mumA.get("/api/ask-mum/pending")).body.requests.length === 0, "the bell is empty again");

  d = await dishOn(2, 5);
  check(d.status === "allowed" && d.askMumApproved === true, "Mee Goreng is unlocked for Aisyah today");
  check((await aisyah.get("/api/ask-mum/5")).body.request.status === "approved", "kid's 05b sees 'approved'");
  check((await dishOn(5, 26)).status === "blocked_parent", "the yes is for that one dish only (Fish & Chips still locked)");

  // ----- "not today" -----
  res = await aisyah.post("/api/ask-mum", { itemId: 10 });
  res = await mumA.put(`/api/ask-mum/${res.body.requestId}`, { decision: "denied" });
  check(res.status === 200 && res.body.status === "denied", "Mum says not today to Milo Ice");
  check((await dishOn(4, 10)).status === "blocked_parent", "Milo Ice stays locked");

  // ----- expired: a request from yesterday can't be approved -----
  res = await aisyah.post("/api/ask-mum", { itemId: 26 });
  asks.find((a) => a.request_id === res.body.requestId).request_date = "2000-01-01";
  check((await mumA.get("/api/ask-mum/pending")).body.requests.length === 0, "yesterday's request drops off the bell");
  res = await mumA.put(`/api/ask-mum/${res.body.requestId}`, { decision: "approved" });
  check(res.status === 409 && /expired/.test(res.body.error), "approving yesterday's request is 409 (expired)");

  // ----- allergies can't be asked for -----
  rules.push({ child_id: ETHAN, rule_type: "no_fried", item_id: null });
  res = await as(ETHAN, "child").post("/api/ask-mum", { itemId: 5 }); // Mee Goreng has shellfish
  check(res.status === 409, "Ethan can't Ask Mum for an allergy dish");

  // ----- turning a rule off unlocks straight away -----
  res = await mumA.put(`/api/children/${AISYAH}/food-rules`, { noSugary: false });
  check(res.status === 200 && res.body.noFried === true && res.body.noSugary === false, "turn no sugary off, no fried stays on");
  check((await dishOn(4, 10)).status === "allowed", "Milo Ice is allowed again");

  console.log(failed ? `\n${failed} test(s) failed` : "\nAll Ask Mum parent tests passed");
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
