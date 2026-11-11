// Parent macros + order history tests (CB69-50)
// Uses a fake in-memory database, so no Supabase connection is needed. Run with: npm test

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database

const jwt = require("jsonwebtoken");
const request = require("supertest");
const N = require("../leslie/services/nutrition");

// ---------- fake data (dates are relative to today so the test works any day) ----------

const today = N.sgToday();
const monday = N.mondayOf(today);
const thisYear = N.sgYear();

const guide = { age_from: 7, age_to: 9, kcal: 1600, carbs_g: "220", protein_g: "34", fat_g: "55", fibre_g: "20", sugar_g: "25" };
const kid = { child_id: 10, display_name: "Ethan", birth_year: thisYear - 9, parent_id: 1 };

const item = (name, kcal, carbs, protein, fat, fibre, sugar, checked = true) =>
  ({ name, qty: 1, kcal, carbs, protein, fat, fibre: fibre === null ? null : String(fibre), sugar: sugar === null ? null : String(sugar), checked });
const order = (id, day, time, total, stall, items, clashes = []) => ({
  order_id: id, day, placed_at: `${day}T${time}:00+08:00`, total_amount: String(total), stall_name: stall, items, clashes,
});

const orders = [
  order(1, today, "12:45", 3.5, "Ah Seng Chicken Rice", [item("Chicken Rice", 520, 66, 28, 14, 2, 3)]),
  order(2, today, "15:20", 4.2, "Hup Kee Noodles", [item("Fishball Noodles", 400, 55, 18, 12, 2, 3), item("Milo", 130, 19, 0, 5, 0, 12)]),
  order(3, N.addDays(monday, -7), "12:40", 3.8, "Mak Cik Nasi Lemak", [item("Nasi Lemak", 640, 70, 22, 30, 3, 6, false)], ["Peanuts"]),
];

let guidesTableExists = true;

function fakeQuery(sql, params = []) {
  if (sql.includes("FROM child_profiles WHERE child_id = $1 AND parent_id = $2"))
    return { rows: kid.child_id === params[0] && kid.parent_id === params[1] ? [{ child_id: kid.child_id }] : [] };
  if (sql.includes("c.birth_year")) return { rows: params[0] === kid.child_id ? [kid] : [] };
  if (sql.includes("FROM nutrient_guides")) {
    if (!guidesTableExists) throw Object.assign(new Error("relation does not exist"), { code: "42P01" });
    return { rows: [guide] };
  }
  if (sql.includes("FROM orders o")) {
    const [, from, to] = params;
    return { rows: orders.filter((o) => o.day >= from && o.day <= to).sort((a, b) => (a.placed_at < b.placed_at ? 1 : -1)) };
  }
  return { rows: [] };
}

const fakePool = { query: async (sql, params) => fakeQuery(sql, params) };
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent1 = tokenFor(1, "parent");
const parent2 = tokenFor(2, "parent");
const kidToken = tokenFor(10, "child");
const get = (path, token = parent1) => request(app).get(`/api${path}`).set("Authorization", token);

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

// ---------- tests ----------

async function run() {
  let res;

  // nutrition maths on its own
  check(N.mondayOf("2026-11-06") === "2026-11-02" && N.mondayOf("2026-11-08") === "2026-11-02", "Monday of a week (Fri and Sun)");
  check(N.statusFor("aim", 46, 34, 0.66) === "on_target", "protein above the guide is on target");
  check(N.statusFor("aim", 6, 20, 0.66) === "low", "fibre far under the share of the day is low");
  check(N.statusFor("limit", 27, 25, 0.6) === "high", "sugar over the guide is a bit high");
  check(N.statusFor("aim", 5, 20, 0.66) === "low" && N.statusFor("aim", null, 20, 0.5) === null, "unknown fibre gets no status");

  // today
  res = await get("/children/10/macros/day");
  const b = res.body;
  check(res.status === 200 && b.isToday && b.meals === 2 && b.totals.kcal === 1050, "today adds up both orders (1,050 kcal)");
  check(b.child.name === "Ethan" && b.child.age === 9 && b.guide.kcal === 1600 && b.energyPct === 66, "today uses the age 9 guide (66% of 1,600)");
  check(b.nutrients.map((n) => n.key).join() === "carbs,protein,fat,fibre,sugar", "five nutrient bars in screen order");
  check(b.nutrients[1].status === "on_target" && b.nutrients[3].status === "low", "protein on target, fibre low");
  check(b.orders[0].name === "Fishball Noodles + Milo" && b.orders[0].price === 4.2 && b.orders[0].kcal === 530, "an order joins its dishes and adds up its kcal");
  check(b.orders[1].allergyClashes.length === 0 && b.orders[1].allergensChecked, "a safe, checked order says so");

  // a past day + bad input
  res = await get(`/children/10/macros/day?date=${N.addDays(monday, -7)}`);
  check(res.status === 200 && !res.body.isToday && res.body.orders[0].allergyClashes[0] === "Peanuts" && !res.body.orders[0].allergensChecked, "a past day shows its order and the allergy clash");
  check((await get("/children/10/macros/day?date=6-11-2026")).status === 400, "bad date is rejected");

  // week
  res = await get("/children/10/macros/week");
  const w = res.body;
  const fridayIn = w.days.filter((d) => !N.isWeekend(d.date)).length === 5;
  check(res.status === 200 && w.start === monday && fridayIn && w.meals === 2, "week runs Mon-Fri with this week's orders");
  check(w.avgKcal === 1050 && w.vsLastWeekPct === Math.round(((1050 - 640) / 640) * 100), "average per day eaten, compared with last week");
  check(w.tip && w.tip.nutrient === "fibre" && w.tip.status === "low", "tip points at the low nutrient");
  check(w.nutrients[3].daysFlagged === 1 && w.nutrients[3].daysCounted === 1, "counts how many days fibre was low");

  // order list
  res = await get("/children/10/orders?range=last_week");
  check(res.status === 200 && res.body.days.length === 1 && res.body.days[0].total === 3.8, "last week's orders grouped by day with the day total");
  res = await get("/children/10/orders");
  check(res.body.range === "this_week" && res.body.days[0].kcal === 1050 && res.body.days[0].total === 7.7, "this week by default, S$7.70 for the day");
  check((await get("/children/10/orders?range=forever")).status === 400, "unknown range is rejected");

  // no guide table yet (migration 003 not run)
  guidesTableExists = false;
  res = await get("/children/10/macros/day");
  check(res.status === 200 && res.body.guide === null && res.body.nutrients.every((n) => n.target === null && n.status === null), "works without the guides table, just no targets");
  guidesTableExists = true;

  // who can see it
  check((await get("/children/10/macros/day", parent2)).status === 404, "another parent cannot see the kid");
  check((await get("/children/10/orders", kidToken)).status === 403, "a kid cannot use the parent screens");
  check((await request(app).get("/api/children/10/macros/week")).status === 401, "not logged in is rejected");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
