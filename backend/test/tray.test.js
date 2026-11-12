// My tray: POST /api/tray/quote and the priceTray service Leroy's checkout reuses (Raghav)
// Uses the same fake in-memory database as the menu tests (test/fixtures/raghavMenuDb.js).
// Run with: npm test   (or just this file: node test/tray.test.js)

process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const db = require("./fixtures/raghavMenuDb");

db.install(); // must happen before the app loads
const app = require("../server");
const Teammates = require("../raghav/services/teammates");
const AskMum = require("../raghav/models/askMumModel");
const { priceTray } = require("../raghav/services/trayPricing");

// ---------- helpers ----------

const tokenFor = (id, role = "child") => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const ETHAN = 3; // Peanuts (severe) + Shellfish, can spend S$5.00
const CHLOE = 4; // Egg
const AISYAH = 5; // no allergies, can spend S$6.00
const LOW_WALLET = 6; // can spend S$2.00 (wallet)
const SPENT_MOST = 7; // can spend S$1.80 (limit left)
const SHORT_DAYS = 8; // S$5 limit, but S$2 on every weekday

// dish ids (see the fixture)
const CHICKEN_RICE = 1; // S$3.50, Lim's. Add-ons 1 Extra chicken S$1.50, 2 Less rice S$0, 3 Egg S$0.80 (Egg)
const ROAST_RICE = 2; // S$3.80, Lim's, has a community photo
const NASI_LEMAK = 4; // Peanuts + Shellfish
const MILO = 10; // S$1.80, Wong's. Add-on 8 Less sweet S$0
const CHENDOL = 11; // S$2.50, NO allergen data
const WATERMELON = 12; // S$2.00, NO allergen data
const WANTON = 14; // Shellfish
const MEE_REBUS = 18; // Peanuts
const SOLD_OUT = 31;

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const line = (itemId, quantity = 1, addOnIds = []) => ({ itemId, quantity, addOnIds });
const quote = (body, childId = AISYAH, role = "child") => {
  const req = request(app).post("/api/tray/quote");
  return (childId === null ? req : req.set("Authorization", tokenFor(childId, role))).send(body);
};
const quoteItems = (items, childId) => quote({ items }, childId);
const allLines = (res) => (res.body.stalls || []).flatMap((s) => s.lines);
// safe even when a broken API sends no problems, so one bug shows as FAIL instead of a crash
const problems = (res) => res.body.problems || [];
const firstProblem = (res) => problems(res)[0] || {};

async function quietly(fn) {
  const realError = console.error;
  console.error = () => {}; // keep the server's expected error log out of the test output
  try { return await fn(); } finally { console.error = realError; }
}

// ---------- tests ----------

async function run() {
  let res;

  // ===== Prices come from the database, never from the client =====
  res = await quote({
    items: [{ itemId: CHICKEN_RICE, quantity: 1, addOnIds: [1, 2], price: 0.01, unitPrice: 0, lineTotal: 0 }],
    total: 0.01,
  });
  check(res.status === 200 && res.body.total === 5 && allLines(res)[0].lineTotal === 5,
    "DB prices are used: S$3.50 + Extra chicken S$1.50 + Less rice S$0 = S$5.00 (client prices ignored)");
  check(allLines(res)[0].unitPrice === 3.5 && allLines(res)[0].addOns.map((a) => a.extraPrice).join() === "1.5,0",
    "unitPrice is the dish alone, each add-on has its own DB extraPrice");
  check(res.body.money.canSpend === 6 && res.body.money.leftAfter === 1 && res.body.money.shortBy === 0 && res.body.canPay === true,
    "money: S$6.00 food money - S$5.00 tray = S$1.00 left, can pay");

  // add-on totals x quantity
  res = await quoteItems([line(CHICKEN_RICE, 3, [3])]);
  check(res.status === 200 && res.body.total === 12.9, "(S$3.50 + egg S$0.80) x 3 = S$12.90");
  check(res.body.canPay === false && res.body.money.shortBy === 6.9 && res.body.money.leftAfter === 0,
    "S$12.90 with S$6.00 to spend: canPay false, short by S$6.90, nothing left after");
  check(allLines(res)[0].addOns[0].name === "Add braised egg", "add-on names come from the DB");

  // the row's photo is the same one the menu shows
  res = await quoteItems([line(ROAST_RICE), line(CHICKEN_RICE)]);
  check(allLines(res)[0].imageUrl === "/uploads/photos/p1.jpg" && allLines(res)[1].imageUrl === "/images/menu/dish-1.jpg",
    "line image = top community photo, else the dish's default image");

  // ===== Two stalls in one tray, grouped =====
  res = await quoteItems([line(CHICKEN_RICE), line(MILO, 2, [8]), line(ROAST_RICE)]);
  const [lims = {}, wongs = {}] = res.body.stalls || [];
  check(res.status === 200 && (res.body.stalls || []).length === 2, "two stalls give two groups");
  check(lims.stallName === "Lim's Chicken Rice" && (lims.lines || []).map((l) => l.lineIndex).join() === "0,2" && lims.subtotal === 7.3,
    "Lim's group has lines 0 and 2, subtotal S$7.30");
  check(wongs.stallName === "Wong's Drinks & Desserts" && (wongs.lines || [{}])[0].lineIndex === 1 && wongs.subtotal === 3.6,
    "Wong's group has line 1 (2 x Milo), subtotal S$3.60");
  check(res.body.total === 10.9 && res.body.canPay === false, "total is both stalls together (S$10.90)");

  // ===== Locked dishes and add-ons -> 409, naming every bad line =====
  res = await quoteItems([line(CHICKEN_RICE), line(NASI_LEMAK)], ETHAN);
  check(res.status === 409 && problems(res).length === 1 && firstProblem(res).lineIndex === 1 &&
    firstProblem(res).itemId === NASI_LEMAK && firstProblem(res).reason === "allergy" && firstProblem(res).addOnId === null,
    "an allergy dish gives 409 and names the line");
  check(firstProblem(res).name === "Nasi Lemak with Chicken Wing" && !res.body.total && !res.body.stalls,
    "the 409 says which dish, and no price is sent");

  res = await quoteItems([line(WANTON), line(CHICKEN_RICE), line(MEE_REBUS)], ETHAN);
  check(res.status === 409 && problems(res).map((p) => p.lineIndex).join() === "0,2",
    "every locked line is listed, not just the first");

  res = await quoteItems([line(CHICKEN_RICE, 1, [2, 3])], CHLOE);
  check(res.status === 409 && problems(res).length === 1 && firstProblem(res).addOnId === 3 &&
    firstProblem(res).reason === "allergy" && firstProblem(res).name === "Add braised egg",
    "an allergy add-on (egg for Chloe) gives 409 and names the add-on");
  res = await quoteItems([line(CHICKEN_RICE, 1, [2])], CHLOE);
  check(res.status === 200 && res.body.total === 3.5, "the same dish without the egg is fine for Chloe");

  // fail closed: no allergen data
  res = await quoteItems([line(CHENDOL)], ETHAN);
  check(res.status === 409 && firstProblem(res).reason === "allergy",
    "a dish with no allergen data is locked for a child with allergies");
  res = await quoteItems([line(CHENDOL)], AISYAH);
  check(res.status === 200, "...but fine for a child with no allergies");

  // Safety rule 3: for EVERY allergen X, a tray with any dish containing X is refused
  let traysWithX = 0, refused = 0;
  for (let allergenId = 1; allergenId <= 9; allergenId++) {
    const name = db.allergens[allergenId].name;
    for (const d of db.dishes.filter((x) => x.is_available && db.dishAllergenNames(x.item_id).includes(name))) {
      traysWithX++;
      res = await quoteItems([line(d.item_id)], 100 + allergenId);
      if (res.status === 409 && firstProblem(res).reason === "allergy") refused++;
    }
  }
  check(traysWithX > 0 && refused === traysWithX, `all ${traysWithX} trays holding a dish with the child's allergen are refused`);

  // every add-on with allergen X is refused for a child allergic to X
  res = await quoteItems([line(CHICKEN_RICE, 1, [3])], 100 + 4); // allergic to Egg only
  check(res.status === 409 && firstProblem(res).addOnId === 3, "an Egg add-on is refused for a child allergic to Egg");

  // sold out, stall closed
  res = await quoteItems([line(SOLD_OUT)]);
  check(res.status === 409 && firstProblem(res).reason === "sold_out", "a dish that sold out gives 409 sold_out");
  const wongsStall = db.stalls.find((s) => s.stall_id === 4);
  wongsStall.is_open = false;
  res = await quoteItems([line(CHICKEN_RICE), line(MILO)]);
  check(res.status === 409 && problems(res).length === 1 && firstProblem(res).lineIndex === 1 &&
    firstProblem(res).reason === "stall_closed", "a dish from a stall that just closed gives 409 stall_closed");
  wongsStall.is_open = true;

  // Mum's rules + Ask Mum (swap in Mum's rules for this test; the fixture has no child_food_rules rows)
  const realRules = Teammates.getFoodRules;
  Teammates.getFoodRules = async (childId) =>
    childId === AISYAH ? [{ type: "blocked_item", itemId: MILO, label: "No Milo" }]
      : childId === ETHAN ? [{ type: "blocked_item", itemId: NASI_LEMAK, label: "No nasi lemak" }] : [];
  res = await quoteItems([line(MILO)]);
  check(res.status === 409 && firstProblem(res).reason === "parent_rule", "a Mum-blocked dish gives 409 parent_rule");
  db.askMum.decide((await AskMum.create(AISYAH, MILO)).request_id, "approved");
  res = await quoteItems([line(MILO)]);
  check(res.status === 200 && res.body.total === 1.8, "Mum's yes today unlocks it in the tray too");
  db.askMum.decide((await AskMum.create(ETHAN, NASI_LEMAK)).request_id, "approved");
  res = await quoteItems([line(NASI_LEMAK)], ETHAN);
  check(res.status === 409 && firstProblem(res).reason === "allergy", "an approval never unlocks an allergy dish");
  Teammates.getFoodRules = realRules;
  db.askMum.reset();

  // "No fried food" is re-checked in the tray too (a real child_food_rules row + menu_items.is_fried)
  db.foodRuleRows.push({ child_id: AISYAH, rule_type: "no_fried", item_id: null });
  res = await quoteItems([line(CHICKEN_RICE), line(5)]); // Mee Goreng is fried
  check(res.status === 409 && problems(res).length === 1 && firstProblem(res).lineIndex === 1 &&
    firstProblem(res).reason === "parent_rule", "no_fried: a fried dish in the tray gives 409 parent_rule");
  res = await quoteItems([line(CHICKEN_RICE)]);
  check(res.status === 200, "no_fried: a dish that isn't fried can still be paid for");
  db.foodRuleRows.length = 0;

  // ===== Bad bodies -> 400 =====
  const badBodies = [
    ["add-on from another dish", { items: [line(ROAST_RICE, 1, [3])] }],
    ["add-on from another dish in the same tray", { items: [line(CHICKEN_RICE), line(ROAST_RICE, 1, [1])] }],
    ["unknown add-on", { items: [line(CHICKEN_RICE, 1, [9999])] }],
    ["duplicate add-ons", { items: [line(CHICKEN_RICE, 1, [3, 3])] }],
    ["quantity 0", { items: [line(CHICKEN_RICE, 0)] }],
    ["quantity 11", { items: [line(CHICKEN_RICE, 11)] }],
    ["quantity 1.5", { items: [line(CHICKEN_RICE, 1.5)] }],
    ["quantity -1", { items: [line(CHICKEN_RICE, -1)] }],
    ['quantity "2"', { items: [line(CHICKEN_RICE, "2")] }],
    ["quantity missing", { items: [{ itemId: CHICKEN_RICE, addOnIds: [] }] }],
    ["21 lines", { items: Array.from({ length: 21 }, () => line(WATERMELON)) }],
    ["empty tray", { items: [] }],
    ["no items", {}],
    ['items "x"', { items: "x" }],
    ["a line that is null", { items: [null] }],
    ['itemId "1"', { items: [line("1")] }],
    ["itemId 0", { items: [line(0)] }],
    ['addOnIds "1"', { items: [{ itemId: CHICKEN_RICE, quantity: 1, addOnIds: "1" }] }],
    ["addOnIds missing", { items: [{ itemId: CHICKEN_RICE, quantity: 1 }] }],
    ["addOnIds [0]", { items: [line(CHICKEN_RICE, 1, [0])] }],
    ["unknown dish", { items: [line(9999)] }],
  ];
  for (const [name, body] of badBodies) {
    res = await quote(body);
    check(res.status === 400 && typeof res.body.error === "string" && !res.body.total, `${name} gives 400`);
  }
  res = await quoteItems([line(CHICKEN_RICE, 10)]);
  check(res.status === 200, "quantity 10 is allowed");
  res = await quoteItems(Array.from({ length: 20 }, () => line(WATERMELON)));
  check(res.status === 200 && res.body.total === 40, "20 lines is allowed");

  // ===== Budget (Safety rule 4) =====
  res = await quoteItems([line(WATERMELON)], LOW_WALLET);
  check(res.body.canPay === true && res.body.money.canSpend === 2 && res.body.money.leftAfter === 0,
    "exactly the food money (S$2.00) can be paid");
  res = await quoteItems([line(CHENDOL)], LOW_WALLET);
  check(res.status === 200 && res.body.canPay === false && res.body.money.shortBy === 0.5,
    "over the wallet: still 200, canPay false, short by S$0.50");
  res = await quoteItems([line(MILO)], SPENT_MOST);
  check(res.body.canPay === true && res.body.money.canSpend === 1.8, "limit minus spent today is the food money");
  res = await quoteItems([line(MILO), line(MILO)], SPENT_MOST);
  check(res.body.canPay === false, "two of the same dish on separate lines are both counted");
  res = await quoteItems([line(CHENDOL)], SHORT_DAYS);
  check(res.body.money.canSpend === 2 && res.body.canPay === false, "the weekday limit (Xin Sheng's moneyService) is used");

  // ===== What Leroy's checkout gets from priceTray =====
  const priced = await priceTray(AISYAH, [line(CHICKEN_RICE, 2, [1]), line(MILO)]);
  check(priced.lines[0].macros.calories === 520 && priced.lines[1].macros.calories === 400,
    "priceTray gives each line's macros for one portion, add-ons included");
  check(priced.stalls.length === 2 && priced.stalls[0].stallId === 1 && priced.stalls[1].stallId === 4 &&
    priced.total === 11.8, "priceTray groups by stall for one order per stall");

  // ===== Who can use it =====
  res = await quoteItems([line(CHICKEN_RICE)], 999);
  check(res.status === 404, "a token with no child profile gets 404");
  res = await quote({ items: [line(CHICKEN_RICE)] }, 1, "parent");
  check(res.status === 403, "a parent token gets 403");
  res = await quote({ items: [line(CHICKEN_RICE)] }, null);
  check(res.status === 401, "not logged in gives 401");

  // fail closed: allergies can't load -> no quote at all
  db.state.failAllergies = true;
  res = await quietly(() => quoteItems([line(CHICKEN_RICE)], AISYAH));
  check(res.status === 500 && !res.body.total && !res.body.stalls, "allergy profile can't load -> 500 and no prices");
  db.state.failAllergies = false;

  // parameterised SQL
  db.state.queries.length = 0;
  await quoteItems([line(1234567)]);
  check(db.state.queries.length > 0 && db.state.queries.every((q) => !q.sql.includes("1234567")),
    "ids never appear in the SQL text");
  check(db.state.queries.some((q) => Array.isArray(q.params[0]) && q.params[0].includes(1234567)),
    "ids are passed as $ parameters");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

// a crash (e.g. a missing field) is a failure too, never a silent stop
run().catch((err) => {
  console.log(`FAIL  test crashed: ${err.message}`);
  process.exitCode = 1;
});
