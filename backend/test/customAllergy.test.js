// Custom allergies (Leslie, migration 005): parent API + how the kid's Home and menu use them.
// Uses Raghav's fake menu database (test/fixtures/raghavMenuDb.js) plus a small fake
// child_custom_allergies table below, so no Supabase connection is needed. Run with: npm test

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database

const jwt = require("jsonwebtoken");
const request = require("supertest");
const db = require("./fixtures/raghavMenuDb");

db.install(); // must happen before the app loads
const pool = require("../config/db");
const { tidyLabel } = require("../leslie/controllers/customAllergyController");

// ---------- fake child_custom_allergies table, kept in step with the fixture's children[].custom ----------

const PARENT = 1;
const OTHER_PARENT = 2;
const KID = 20; // fixture child with ONLY custom allergies: Watermelon, Ice cream
const ownerOf = { 20: PARENT, 3: OTHER_PARENT };
let nextId = 1;
const ids = new Map(); // `${childId}:${lower label}` -> id
const idFor = (childId, label) => {
  const key = `${childId}:${label.toLowerCase()}`;
  if (!ids.has(key)) ids.set(key, nextId++);
  return ids.get(key);
};
const customOf = (childId) => (db.children[childId].custom = db.children[childId].custom || []);

const realQuery = pool.query;
pool.query = async (sql, params = []) => {
  db.state.queries.push({ sql, params });
  const [p1, p2] = params;
  if (sql.includes("FROM child_profiles WHERE child_id = $1 AND parent_id = $2"))
    return { rows: ownerOf[p1] === p2 ? [{ child_id: p1 }] : [] };
  if (sql.includes("SELECT name FROM allergens")) return { rows: Object.values(db.allergens).map((a) => ({ name: a.name })) };
  if (sql.includes("COUNT(*)::int AS n FROM child_custom_allergies")) return { rows: [{ n: customOf(p1).length }] };
  if (sql.includes("INSERT INTO child_custom_allergies")) {
    if (customOf(p1).some((l) => l.toLowerCase() === p2.toLowerCase()))
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    customOf(p1).push(p2);
    return { rows: [{ custom_allergy_id: idFor(p1, p2), label: p2, icon: "⚠️" }] };
  }
  if (sql.includes("DELETE FROM child_custom_allergies")) {
    const list = customOf(p1);
    const i = list.findIndex((l) => idFor(p1, l) === p2);
    if (i >= 0) list.splice(i, 1);
    return { rowCount: i >= 0 ? 1 : 0, rows: [] };
  }
  if (sql.includes("FROM child_custom_allergies ca") && sql.includes("blocked_dishes")) {
    return {
      rows: customOf(p1).map((label) => ({
        custom_allergy_id: idFor(p1, label), label, icon: "⚠️",
        blocked_dishes: db.dishes.filter((d) => db.mentionsFood(`${d.name} ${d.description}`, label)).map((d) => d.name).sort(),
      })),
    };
  }
  return realQuery(sql, params);
};

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const asParent = (req, id = PARENT) => req.set("Authorization", tokenFor(id, "parent"));
const url = (childId = KID) => `/api/children/${childId}/custom-allergies`;
const add = (label, childId = KID) => asParent(request(app).post(url(childId))).send({ label });
const kidGet = (path, childId = KID) => request(app).get(path).set("Authorization", tokenFor(childId, "child"));

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

async function run() {
  // ===== label tidying + matching rule (same as mentions_food in the migration) =====
  check(tidyLabel("  kiwi   FRUIT ") === "Kiwi fruit", "label is trimmed, spaces squashed, first letter capital");
  check(db.mentionsFood("Fresh strawberries", "Strawberry"), "strawberry also blocks strawberries");
  check(!db.mentionsFood("Pineapple tart", "Apple"), "apple does not match inside pineapple");
  check(db.mentionsFood("Satay with peanut sauce", "Pea"), "pea matches peanut (fails closed)");
  check(!db.mentionsFood("Kids set. No chilli.", "Chilli") && !db.mentionsFood("Without chilli please", "chilli"),
    "'No chilli' / 'without chilli' don't count");
  check(db.mentionsFood("Less chilli sauce", "Chilli"), "'Less chilli sauce' still counts");

  // ===== parent API =====
  let res = await asParent(request(app).get(url()));
  check(res.status === 200 && res.body.customAllergies.map((a) => a.label).join() === "Watermelon,Ice cream",
    "parent lists their kid's custom allergies");
  const melon = res.body.customAllergies[0];
  check(melon.icon === "⚠️" && melon.blockedDishes.join() === "Fresh Watermelon Juice",
    "each custom allergy says which dishes it blocks right now");

  res = await add("  mango ");
  check(res.status === 201 && res.body.customAllergies.some((a) => a.label === "Mango"), "parent adds 'mango', saved as 'Mango'");
  res = await add("MANGO");
  check(res.status === 409, "adding the same word again (any capitals) is refused");
  res = await add("egg");
  check(res.status === 400 && /Egg is already in the list/.test(res.body.error), "a preset allergen points the parent to its chip");
  res = await add("Peanut");
  check(res.status === 400 && /Peanuts/.test(res.body.error), "'Peanut' is matched to the preset 'Peanuts'");
  res = await add("gluten");
  check(res.status === 400 && /Wheat \/ gluten/.test(res.body.error), "'gluten' is matched to 'Wheat / gluten'");
  for (const bad of ["", "k", "<script>", "1234", "a".repeat(41), null]) {
    res = await asParent(request(app).post(url())).send({ label: bad });
    check(res.status === 400, `rejects label ${JSON.stringify(bad && bad.length > 12 ? bad.slice(0, 8) + "…" : bad)}`);
  }
  for (const word of ["Kiwi", "Tomato", "Coconut", "Durian", "Lychee", "Okra", "Corn"]) await add(word);
  res = await add("Celery");
  check(res.status === 400 && /up to 10/.test(res.body.error), "a kid can have at most 10 custom allergies");

  res = await asParent(request(app).get(url(3)));
  check(res.status === 404, "parent can't see another parent's kid");
  res = await asParent(request(app).post(url(3))).send({ label: "Kiwi" });
  check(res.status === 404, "parent can't add to another parent's kid");
  res = await request(app).get(url()).set("Authorization", tokenFor(KID, "child"));
  check(res.status === 403, "a child can't change their own allergies");
  res = await request(app).get(url());
  check(res.status === 401, "not logged in is refused");

  const mangoId = idFor(KID, "Mango");
  res = await asParent(request(app).delete(`${url()}/${mangoId}`));
  check(res.status === 204 && !customOf(KID).includes("Mango"), "parent removes a custom allergy");
  res = await asParent(request(app).delete(`${url()}/${mangoId}`));
  check(res.status === 404, "removing it twice says not found");
  res = await asParent(request(app).delete(`${url()}/abc`));
  check(res.status === 400, "bad id is rejected");
  res = await asParent(request(app).delete(`${url(3)}/${mangoId}`));
  check(res.status === 404, "can't remove from another parent's kid");
  db.children[KID].custom = ["Watermelon", "Ice cream"]; // back to the fixture's state

  // ===== kid's menu uses them =====
  res = await kidGet("/api/stalls/4/menu?view=all");
  const juice = res.body.dishes.find((d) => d.id === 12);
  check(juice.status === "blocked_allergy" && juice.blockedAllergens.length === 1 &&
    juice.blockedAllergens[0].name === "Watermelon" && juice.blockedAllergens[0].icon === "⚠️",
    "Fresh Watermelon Juice is locked for a kid with a watermelon allergy, with the word as the reason");
  res = await kidGet("/api/stalls/4/menu");
  check(!res.body.dishes.some((d) => d.id === 12), '"Safe for me" leaves the watermelon dish out');
  check(res.body.dishes.some((d) => d.id === 24), "Ice Kacang stays (its name doesn't say ice cream)");
  check(!res.body.dishes.some((d) => d.id === 11), "untagged Chendol stays locked: custom allergies count for fail-closed too");

  res = await kidGet("/api/menu-items/24");
  const iceCream = res.body.dish.addOns.find((a) => a.id === 12);
  check(iceCream && iceCream.locked === true && iceCream.lockReason === "allergy", "'Add vanilla ice cream' add-on is locked");
  check(res.body.dish.safeChecks.includes("No watermelon") && res.body.dish.safeChecks.includes("No ice cream"),
    '"Safe for you!" lists the custom allergies too');

  res = await kidGet("/api/stalls/4/menu", 5); // Aisyah: no allergies at all
  check(res.body.dishes.some((d) => d.id === 12), "another kid still sees the watermelon juice");

  // ===== kid's Home shows them as Mum's rules =====
  const { getRules } = require("../gabriel/models/homeModel");
  const rules = await getRules(KID);
  check(rules.map((r) => r.name).join() === "Watermelon,Ice cream", "Home's 'Mum's rules' include custom allergies");

  // parameterised SQL
  db.state.queries.length = 0;
  await add("Kiwi");
  check(db.state.queries.some((q) => q.params.includes("Kiwi")), "the typed word is sent as a $ parameter");
  check(!JSON.stringify(db.state.queries.map((q) => q.sql)).includes("Kiwi"), "the typed word never goes into the SQL text");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
