// Stall menu + food detail endpoint tests (Raghav)
// Uses a fake in-memory database (test/fixtures/raghavMenuDb.js), so no Supabase connection is needed.
// Run with: npm test   (or just this file: node test/menu.test.js)

process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const db = require("./fixtures/raghavMenuDb");

db.install(); // must happen before the app loads
const app = require("../server");
const Teammates = require("../raghav/services/teammates");

// ---------- helpers ----------

const tokenFor = (id, role = "child") => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const ETHAN = 3; // Peanuts (severe) + Shellfish
const CHLOE = 4; // Egg
const AISYAH = 5; // no allergies
const LOW_WALLET = 6; // can spend S$2.00
const SPENT_MOST = 7; // S$5 limit, S$3.20 spent -> can spend S$1.80

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const get = (path, childId = ETHAN, role = "child") => {
  const req = request(app).get(path);
  return childId === null ? req : req.set("Authorization", tokenFor(childId, role));
};
const menu = (stallId, childId, view) => get(`/api/stalls/${stallId}/menu${view ? `?view=${view}` : ""}`, childId);
const byId = (res, id) => res.body.dishes.find((d) => d.id === id);
const STALL_IDS = db.stalls.map((s) => s.stall_id);

async function quietly(fn) {
  const realError = console.error;
  console.error = () => {}; // keep the server's expected error log out of the test output
  try { return await fn(); } finally { console.error = realError; }
}

// ---------- tests ----------

async function run() {
  let res;

  // ===== Safety rule 3: for EVERY allergen X, a child allergic to X sees zero dishes containing X =====
  for (let allergenId = 1; allergenId <= 9; allergenId++) {
    const name = db.allergens[allergenId].name;
    const childId = 100 + allergenId;
    let shownWithX = 0, shownUnknown = 0, lockedInAll = 0, containingX = 0, okStatus = true;

    for (const stallId of STALL_IDS) {
      res = await menu(stallId, childId); // default view = safe
      okStatus = okStatus && res.status === 200;
      for (const d of res.body.dishes) {
        if (db.dishAllergenNames(d.id).includes(name)) shownWithX++;
        if (db.dishAllergenNames(d.id).length === 0) shownUnknown++;
      }

      res = await menu(stallId, childId, "all");
      for (const d of res.body.dishes.filter((x) => db.dishAllergenNames(x.id).includes(name))) {
        containingX++;
        if (d.status === "blocked_allergy" && d.blockedAllergens.some((a) => a.name === name)) lockedInAll++;
      }
    }
    check(okStatus && shownWithX === 0, `allergic to ${name}: "Safe for me" shows 0 dishes containing ${name}`);
    check(shownUnknown === 0, `allergic to ${name}: dishes with no allergen data are not shown either (fail closed)`);
    check(containingX > 0 && lockedInAll === containingX,
      `allergic to ${name}: "Everything" shows all ${containingX} such dishes locked, naming ${name}`);
  }

  // ...and the same on food detail: a dish with X is locked and has no add-ons to order
  for (let allergenId = 1; allergenId <= 9; allergenId++) {
    const name = db.allergens[allergenId].name;
    const containing = db.dishes.filter((d) => d.is_available && db.dishAllergenNames(d.item_id).includes(name));
    let allLocked = true;
    for (const d of containing) {
      res = await get(`/api/menu-items/${d.item_id}`, 100 + allergenId);
      allLocked = allLocked && res.status === 200 && res.body.dish.status === "blocked_allergy" &&
        res.body.dish.addOns.length === 0 && res.body.dish.safeChecks.length === 0 &&
        res.body.alternatives.every((a) => !db.dishAllergenNames(a.id).includes(name));
    }
    check(allLocked, `allergic to ${name}: food detail locks all ${containing.length} dishes with it, no add-ons, safe alternatives`);
  }

  // ===== Stall menu =====
  res = await menu(1, ETHAN);
  check(res.status === 200 && res.body.stall.id === 1 && res.body.stall.name === "Lim's Chicken Rice",
    "menu includes the stall, same shape as GET /api/stalls/:id");
  check(res.body.stall.coverImageUrl === null, "stall with no cover has coverImageUrl null");
  check(byId(res, 14) === undefined, "Ethan (shellfish): Dry Wanton Noodles is left out of the default view");
  check(res.body.counts.safe === 5 && res.body.counts.total === 6, "counts: 5 safe of 6 dishes at Lim's for Ethan");
  check(byId(res, 31) === undefined, "sold-out dish (is_available = false) is not on the menu");

  const roast = byId(res, 2);
  check(roast && roast.name === "Roasted Chicken Rice" && roast.price === 3.8 && roast.status === "allowed" &&
    roast.overBudget === false && Array.isArray(roast.badges), "dish card has the agreed fields");
  check(roast.imageUrl === "/uploads/photos/p1.jpg" && roast.hearts === 3,
    "image = most-hearted APPROVED photo (the pending one with more hearts is skipped)");
  check(byId(res, 1).imageUrl === "/images/menu/dish-1.jpg" && byId(res, 1).hearts === 0,
    "dish whose only photo failed the AI check falls back to default_image_url");

  res = await menu(1, ETHAN, "all");
  const wanton = byId(res, 14);
  check(res.body.dishes.length === 6 && wanton.status === "blocked_allergy" &&
    wanton.blockedAllergens.length === 1 && wanton.blockedAllergens[0].name === "Shellfish" && wanton.blockedAllergens[0].icon === "🦐",
    '"Everything" includes the locked dish with which allergen and its icon');

  // "Everything": allowed dishes first, then locked ones, each group still in menu order
  res = await menu(2, ETHAN, "all");
  const order = res.body.dishes.map((x) => x.id);
  check(order.join() === "6,16,17,4,5,18", `"Everything" lists allowed dishes first, then locked (got ${order.join()})`);
  const firstLocked = res.body.dishes.findIndex((x) => x.status !== "allowed");
  check(firstLocked > 0 && res.body.dishes.slice(firstLocked).every((x) => x.status !== "allowed"),
    "no allowed dish comes after a locked one");
  res = await menu(2, ETHAN);
  check(res.body.dishes.map((x) => x.id).join() === "6,16,17", '"Safe for me" keeps menu order');

  res = await menu(4, ETHAN, "all");
  check(byId(res, 11).status === "blocked_allergy" && byId(res, 11).reason === "unknown_allergens",
    "Chendol (no allergen data) is locked for Ethan with reason unknown_allergens");
  res = await menu(4, AISYAH);
  check(byId(res, 11) && byId(res, 11).status === "allowed", "Chendol is allowed for Aisyah, who has no allergies");
  check(res.body.dishes.length === 6, "Aisyah sees every Wong's dish");

  // budget (Safety rule 4)
  res = await menu(4, LOW_WALLET);
  check(res.body.money.canSpend === 2, "canSpend is the wallet when it's lower than the limit left");
  check(byId(res, 11).overBudget === true && byId(res, 12).overBudget === false && byId(res, 10).overBudget === false,
    "over S$2.00 is overBudget, exactly S$2.00 is not");
  check(byId(res, 11).status === "allowed", "an over-budget dish is still shown (unavailable, not hidden)");
  res = await menu(4, SPENT_MOST);
  check(res.body.money.canSpend === 1.8, "canSpend = daily limit minus spent today, when lower than the wallet");
  check(byId(res, 12).overBudget === true && byId(res, 10).overBudget === false, "budget uses what's left today");
  res = await menu(4, 8); // S$5 normal limit, but Mum set S$2 for every weekday (Xin Sheng's moneyService)
  check(res.body.money.canSpend === 2 && byId(res, 11).overBudget === true,
    "the weekday limit (child_day_limits) is used instead of the normal daily limit");

  // Mum's rules (swapped in for this test; the no_fried block below uses real child_food_rules rows)
  const realRules = Teammates.getFoodRules;
  Teammates.getFoodRules = async (childId) =>
    childId === CHLOE ? [{ type: "blocked_item", itemId: 10, label: "No Milo on school days" }] : [];
  res = await menu(4, CHLOE, "all");
  check(byId(res, 10).status === "blocked_parent" && byId(res, 10).parentRule.label === "No Milo on school days",
    "Mum's rule gives blocked_parent with the rule");
  res = await menu(4, CHLOE);
  check(byId(res, 10) === undefined, '"Safe for me" hides a blocked_parent dish too');
  res = await get("/api/menu-items/10", CHLOE);
  check(res.body.dish.status === "blocked_parent" && res.body.dish.addOns.length === 0,
    "food detail of a Mum-blocked dish has no add-ons");
  res = await menu(4, AISYAH, "all");
  check(byId(res, 10).status === "allowed", "Mum's rule for one child doesn't affect another child");
  Teammates.getFoodRules = realRules;

  // Mum's "No fried food" (rule_type no_fried), end to end: a child_food_rules row goes through
  // Leroy's listRulesForChild, Raghav's getFoodRules and menu_items.is_fried
  db.foodRuleRows.push({ child_id: AISYAH, rule_type: "no_fried", item_id: null });
  const allDishes = [];
  for (const id of STALL_IDS) allDishes.push(...(await menu(id, AISYAH, "all")).body.dishes);
  const fried = allDishes.filter((x) => db.FRIED.has(x.id));
  const notFried = allDishes.filter((x) => !db.FRIED.has(x.id));
  check(fried.length === db.FRIED.size && fried.every((x) => x.status === "blocked_parent"),
    `no_fried: all ${db.FRIED.size} fried dishes are blocked_parent`);
  check(fried.every((x) => x.parentRule.type === "no_fried" && x.parentRule.label === "No fried food"),
    'no_fried: the rule comes with the label "No fried food" (05b copy)');
  check(notFried.length > 0 && notFried.every((x) => x.status === "allowed"),
    `no_fried: the ${notFried.length} dishes that aren't fried stay allowed`);
  let safeFried = 0;
  for (const id of STALL_IDS) safeFried += (await menu(id, AISYAH)).body.dishes.filter((x) => db.FRIED.has(x.id)).length;
  check(safeFried === 0, '"Safe for me" shows 0 fried dishes to a no_fried child');
  res = await get("/api/menu-items/5", AISYAH); // Mee Goreng, fried
  check(res.body.dish.status === "blocked_parent" && res.body.dish.addOns.length === 0, "food detail of a fried dish is locked");
  res = await get("/api/menu-items/6", AISYAH); // Plain Nasi Lemak, not fried
  check(res.body.dish.status === "allowed" && res.body.dish.safeChecks.includes("Not fried"),
    'a dish known not to be fried says "Not fried" on Food detail');
  check(byId(await menu(2, ETHAN, "all"), 5).status !== "blocked_parent", "one child's no_fried rule doesn't touch another child");
  db.foodRuleRows.length = 0;

  // ===== Food detail =====
  res = await get("/api/menu-items/2", ETHAN);
  const d = res.body.dish;
  check(res.status === 200 && d.id === 2 && d.stallId === 1 && d.stallName === "Lim's Chicken Rice" &&
    d.status === "allowed" && typeof d.description === "string", "food detail has the dish and its stall");
  check(d.photo && d.photo.photoId === 1 && d.photo.uploaderUsername === "kai_snaps" && d.photo.hearts === 3 &&
    d.photo.totalPics === 2 && d.photo.likedByMe === true, "photo: uploader, hearts, approved pic count, liked by me");
  check(d.safeChecks.join() === "No peanuts,No shellfish,Not fried",
    '"Safe for you!" ticks list Ethan\'s allergies, then "Not fried" (is_fried = false)');
  check(d.healthScore === null && Array.isArray(d.ingredients) && d.ingredients.length === 0,
    "health score and ingredients are empty until their columns exist");

  res = await get("/api/menu-items/1", CHLOE);
  const extras = res.body.dish.addOns;
  check(extras.length === 3 && extras.every((a) => typeof a.extraPrice === "number"), "food detail lists the dish's add-ons");
  const egg = extras.find((a) => a.id === 3);
  check(egg.locked === true && egg.lockReason === "allergy" && egg.allergen.name === "Egg" && egg.allergen.icon === "🥚",
    "Chloe (egg): 'Add braised egg' is locked, with its allergen");
  check(extras.filter((a) => a.id !== 3).every((a) => a.locked === false && a.allergen === null),
    "add-ons without an allergen stay unlocked");
  check(res.body.dish.photo === null, "dish with no approved photo has photo null");

  res = await get("/api/menu-items/14", ETHAN);
  check(res.body.dish.status === "blocked_allergy" && res.body.dish.addOns.length === 0,
    "locked dish: status says why, and there are no add-ons");
  const alts = res.body.alternatives;
  check(alts.length === 2 && alts.every((a) => a.status === "allowed" && !a.overBudget && a.id !== 14),
    "2 alternatives, all allowed and affordable, never the dish itself");
  check(alts[0].id === 2, "most-hearted alternative comes first");

  res = await get("/api/menu-items/11", LOW_WALLET);
  check(res.body.dish.status === "allowed" && res.body.dish.overBudget === true,
    "food detail reports overBudget on a dish the child can't afford (S$2.50 > S$2.00)");
  check(res.body.money && res.body.money.canSpend === 2, "food detail includes money.canSpend (for extras + quantity)");

  // ===== errors and access =====
  res = await menu(999, ETHAN);
  check(res.status === 404 && res.body.error === "Stall not found", "unknown stall gives 404");
  res = await get("/api/menu-items/999");
  check(res.status === 404 && res.body.error === "Dish not found", "unknown dish gives 404");
  res = await get("/api/menu-items/31");
  check(res.status === 404, "sold-out dish gives 404");
  for (const bad of ["abc", "0", "-1", "1.5"]) {
    res = await get(`/api/stalls/${bad}/menu`);
    check(res.status === 400 && res.body.error === "Invalid stall id", `stall id "${bad}" gives 400`);
    res = await get(`/api/menu-items/${bad}`);
    check(res.status === 400 && res.body.error === "Invalid dish id", `dish id "${bad}" gives 400`);
  }
  for (const view of ["bogus", "SAFE", "safe&view=all"]) {
    res = await get(`/api/stalls/1/menu?view=${view}`);
    check(res.status === 400 && res.body.error === "view must be safe or all", `view=${view} gives 400`);
  }
  res = await menu(1, 999);
  check(res.status === 404 && res.body.error === "Child not found" && !res.body.dishes, "a token with no child profile gets no menu");
  res = await get("/api/stalls/1/menu", 1, "parent");
  check(res.status === 403, "a parent token gets 403");
  res = await get("/api/menu-items/2", 1, "parent");
  check(res.status === 403, "a parent token gets 403 on food detail");
  res = await get("/api/stalls/1/menu", null);
  check(res.status === 401, "not logged in gives 401");

  // fail closed: if allergies can't be loaded, NO menu is sent
  db.state.failAllergies = true;
  res = await quietly(() => menu(1, ETHAN, "all"));
  check(res.status === 500 && res.body.error === "Something went wrong" && !res.body.dishes,
    "allergy profile can't load -> 500 and no dishes at all");
  res = await quietly(() => get("/api/menu-items/2", AISYAH));
  check(res.status === 500 && !res.body.dish, "allergy profile can't load -> food detail is not sent either");
  db.state.failAllergies = false;

  // parameterised SQL: user input only ever travels as a $ parameter
  db.state.queries.length = 0;
  await get("/api/stalls/4/menu?view=all");
  await get("/api/menu-items/22");
  check(db.state.queries.length > 0 && db.state.queries.every((q) => !/\b(4|22)\b/.test(q.sql.replace(/\$\d+/g, ""))),
    "ids never appear in the SQL text");
  check(db.state.queries.some((q) => q.params[0] === 4) && db.state.queries.some((q) => q.params[0] === 22),
    "ids are passed as $ parameters");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
