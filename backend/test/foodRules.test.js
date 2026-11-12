// Parent Menu locks: GET /children/:id/menu, PUT /children/:id/blocked-items/:itemId, and
// that the kid's menu rules (Raghav's getFoodRules) come from the same locks.
// Uses a fake in-memory database, so no Supabase connection is needed.
// Run with: npm test

process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const dishes = [
  { item_id: 1, name: "Fishball soup", price: "3.00", default_image_url: null, stall_name: "Ah Ma", allergen_names: ["Fish"] },
  { item_id: 2, name: "Carrot cake", price: "3.00", default_image_url: null, stall_name: "Ah Ma", allergen_names: ["Egg"] },
  { item_id: 3, name: "Mystery bun", price: "2.00", default_image_url: null, stall_name: "Uncle Lim", allergen_names: [] },
];
const profiles = [{ child_id: 10, parent_id: 1 }]; // kid 10 belongs to parent 1
const allergies = { 10: ["Fish"] };
let rules = []; // { rule_id, child_id, rule_type, item_id }

// ---------- fake database ----------

const fakePool = {
  query: async (sql, params = []) => {
    if (sql.includes("FROM child_profiles WHERE child_id")) {
      const [childId, parentId] = params;
      return { rows: profiles.filter((p) => p.child_id === childId && p.parent_id === parentId) };
    }
    if (sql.includes("FROM child_allergies ca JOIN allergens")) return { rows: (allergies[params[0]] || []).map((name) => ({ name })) };
    if (sql.includes("FROM menu_items m") && sql.includes("JOIN stalls s")) {
      const locked = (id) => rules.some((r) => r.child_id === params[0] && r.item_id === id);
      return { rows: dishes.map((d) => ({ ...d, locked: locked(d.item_id) })) };
    }
    if (sql.includes("INSERT INTO child_food_rules")) {
      const [child_id, item_id] = params;
      if (!dishes.some((d) => d.item_id === item_id)) return { rows: [], rowCount: 0 };
      if (rules.some((r) => r.child_id === child_id && r.item_id === item_id)) return { rows: [], rowCount: 0 }; // already locked
      rules.push({ rule_id: rules.length + 1, child_id, rule_type: "blocked_item", item_id });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT 1 FROM menu_items")) return { rows: dishes.filter((d) => d.item_id === params[0]).map(() => ({})) };
    if (sql.includes("DELETE FROM child_food_rules")) {
      rules = rules.filter((r) => !(r.child_id === params[0] && r.item_id === params[1]));
      return { rows: [] };
    }
    if (sql.includes("FROM child_food_rules r")) {
      return {
        rows: rules
          .filter((r) => r.child_id === params[0])
          .map((r) => ({ rule_type: r.rule_type, item_id: r.item_id, name: dishes.find((d) => d.item_id === r.item_id).name })),
      };
    }
    return { rows: [] };
  },
};
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const app = require("../server");
const Teammates = require("../raghav/services/teammates");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent1 = tokenFor(1, "parent");
const parent2 = tokenFor(2, "parent"); // someone else's parent
const kid = tokenFor(10, "child");
const menu = (token, childId = 10) => request(app).get(`/api/children/${childId}/menu`).set("Authorization", token);
const lock = (token, itemId, locked, childId = 10) =>
  request(app).put(`/api/children/${childId}/blocked-items/${itemId}`).set("Authorization", token).send({ locked });

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

// ---------- tests ----------

async function run() {
  let res = await menu(parent1);
  const byId = (r, id) => r.body.dishes.find((d) => d.id === id);
  check(res.status === 200 && res.body.dishes.length === 3, "parent sees every dish on the menu");
  check(byId(res, 1).allergyBlocked === true && byId(res, 2).allergyBlocked === false, "a dish with the kid's allergen is allergy-blocked");
  check(byId(res, 3).allergyBlocked === true, "a dish with no allergen info is blocked for a kid with allergies (fail closed)");
  check(res.body.dishes.every((d) => d.locked === false), "nothing is locked to start with");

  res = await lock(parent1, 2, true);
  check(res.status === 200 && res.body.locked === true, "parent locks a dish");
  check(byId(await menu(parent1), 2).locked === true, "the menu shows it locked");
  check((await lock(parent1, 2, true)).status === 200 && rules.length === 1, "locking twice keeps one rule");

  // the kid's menu reads the same rule
  const kidRules = await Teammates.getFoodRules(10);
  check(kidRules.length === 1 && kidRules[0].type === "blocked_item" && kidRules[0].itemId === 2 && kidRules[0].label === "Carrot cake", "the kid's menu gets the lock as a Mum rule");
  check((await Teammates.getFoodRules(11)).length === 0, "another kid has no rules");

  res = await lock(parent1, 2, false);
  check(res.status === 200 && res.body.locked === false && rules.length === 0, "parent unlocks it again");
  check((await Teammates.getFoodRules(10)).length === 0, "the kid's menu no longer has the rule");

  check((await lock(parent1, 99, true)).status === 404, "locking a dish that doesn't exist is 404");
  check((await lock(parent1, "abc", true)).status === 400, "bad dish id is 400");
  check((await request(app).put("/api/children/10/blocked-items/2").set("Authorization", parent1).send({ locked: "yes" })).status === 400, "locked must be true or false");

  check((await lock(parent2, 2, true)).status === 404, "another parent can't lock dishes for this kid");
  check((await menu(parent2)).status === 404, "another parent can't see this kid's menu");
  check((await lock(kid, 2, true)).status === 403, "a kid can't lock dishes");
  check((await menu(kid)).status === 403, "a kid can't use the parent menu");
  check((await request(app).get("/api/children/10/menu")).status === 401, "not logged in is rejected");
  check(rules.length === 0, "no rule was saved by the rejected calls");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
