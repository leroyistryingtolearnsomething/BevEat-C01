// Parent adds a kid tests
// Uses a fake in-memory database, so no Supabase connection is needed.
// Run with: npm test

process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const ALLERGEN_NAMES = ["Peanuts", "Tree nuts", "Milk", "Egg", "Shellfish", "Fish", "Soy", "Wheat / gluten", "Sesame"];
let users = [{ user_id: 1, role: "parent", username: null }, { user_id: 2, role: "child", username: "ethan" }];
let profiles = [];
let allergies = [];

// ---------- fake database (transactions copy the data and put it back on ROLLBACK) ----------

let saved = null;
const client = {
  query: async (sql, params = []) => {
    if (sql === "BEGIN") saved = JSON.stringify({ users, profiles, allergies });
    if (sql === "ROLLBACK") ({ users, profiles, allergies } = JSON.parse(saved));
    if (sql.includes("INSERT INTO users")) {
      const [display_name, username, password_hash] = params;
      if (users.some((u) => u.username === username)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      const row = { user_id: users.length + 1, role: "child", display_name, username, password_hash };
      users.push(row);
      return { rows: [row] };
    }
    if (sql.includes("INSERT INTO child_profiles")) {
      const [child_id, parent_id, daily_limit] = params;
      profiles.push({ child_id, parent_id, daily_limit });
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO child_allergies")) {
      const [child_id, names] = params;
      const found = names.filter((n) => ALLERGEN_NAMES.includes(n));
      found.forEach((name) => allergies.push({ child_id, name }));
      return { rows: [], rowCount: found.length };
    }
    if (sql.includes("DELETE FROM child_allergies")) {
      allergies = allergies.filter((a) => a.child_id !== params[0]);
      return { rows: [] };
    }
    if (sql.includes("SET daily_limit")) {
      profiles.find((p) => p.child_id === params[0]).daily_limit = params[1];
      return { rows: [] };
    }
    if (sql.includes("JOIN users")) {
      const rows = profiles.filter((p) => p.parent_id === params[0]).map((p) => ({
        child_id: p.child_id, display_name: users.find((u) => u.user_id === p.child_id).display_name,
        wallet_balance: "0.00", daily_limit: String(p.daily_limit), spent_today: "0",
        allergens: allergies.filter((a) => a.child_id === p.child_id).map((a) => a.name),
      }));
      return { rows };
    }
    if (sql.includes("FROM child_profiles WHERE child_id = $1 AND parent_id = $2"))
      return { rows: profiles.filter((p) => p.child_id === params[0] && p.parent_id === params[1]) };
    return { rows: [] };
  },
  release: () => {},
};
const fakePool = { connect: async () => client, query: client.query };

// swap the real db.js for the fake one before the app loads
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const app = require("../server");

// ---------- helpers ----------

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent = tokenFor(1, "parent");
const kidToken = tokenFor(2, "child");
const add = (body, token = parent) => request(app).post("/api/children").set("Authorization", token).send(body);
const good = { displayName: " Chloe ", username: "Chloe_Eats", pin: "4321", colour: "#2F6DB5", dailyLimitCents: 600, allergens: ["peanut", "wheat", "peanut"] };

// ---------- tests ----------

async function run() {
  let res = await add(good);
  const kid = users.at(-1);
  check(res.status === 201 && res.body.child.name === "Chloe" && res.body.child.username === "chloe_eats", "parent adds a kid");
  check(kid.role === "child" && kid.username === "chloe_eats", "login name saved lower case");
  check(kid.password_hash !== "4321" && bcrypt.compareSync("4321", kid.password_hash), "PIN saved as a bcrypt hash");
  check(profiles.at(-1).parent_id === 1 && profiles.at(-1).daily_limit === 6, "kid belongs to the parent with S$6 a day");
  check(allergies.map((a) => a.name).sort().join() === "Peanuts,Wheat / gluten", "allergies saved once each with database names");

  res = await add({ ...good, username: "CHLOE_eats" });
  check(res.status === 409, "taken login name is rejected");

  const before = JSON.stringify({ users, profiles, allergies });
  ALLERGEN_NAMES.splice(ALLERGEN_NAMES.indexOf("Sesame"), 1);
  res = await add({ ...good, username: "sam", allergens: ["sesame"] });
  check(res.status === 500 && JSON.stringify({ users, profiles, allergies }) === before, "kid is not saved if an allergy can't be saved");
  ALLERGEN_NAMES.push("Sesame");

  for (const [field, bad] of [["displayName", " "], ["username", "ab"], ["username", "has space"], ["pin", "123"], ["pin", 1234], ["dailyLimitCents", 50], ["dailyLimitCents", "600"], ["allergens", ["toString"]], ["allergens", "peanut"]])
    check((await add({ ...good, username: "newkid", [field]: bad })).status === 400, `bad ${field} ${JSON.stringify(bad)} is rejected`);

  check((await add(good, kidToken)).status === 403, "kid cannot add a kid");
  check((await request(app).post("/api/children").send(good)).status === 401, "not logged in is rejected");

  // list, change allergies, change daily limit
  const chloeId = kid.user_id;
  const otherParent = tokenFor(99, "parent");
  const put = (path, body, token = parent) => request(app).put(`/api/children/${chloeId}/${path}`).set("Authorization", token).send(body);

  res = await request(app).get("/api/children").set("Authorization", parent);
  const listed = res.body.children[0];
  check(res.status === 200 && listed.name === "Chloe" && listed.dailyLimit === 6 && listed.allergens.sort().join() === "peanut,wheat", "parent's kids list shows limit and allergy keys");

  res = await put("allergies", { allergens: ["egg", "tree nuts", "egg"] });
  check(res.status === 200 && allergies.filter((a) => a.child_id === chloeId).map((a) => a.name).sort().join() === "Egg,Tree nuts", "allergies replaced");

  res = await put("allergies", { allergens: [] });
  check(res.status === 200 && !allergies.some((a) => a.child_id === chloeId), "all allergies can be removed");

  const beforeSet = JSON.stringify(allergies);
  await put("allergies", { allergens: ["milk"] });
  ALLERGEN_NAMES.splice(ALLERGEN_NAMES.indexOf("Sesame"), 1);
  res = await put("allergies", { allergens: ["sesame"] });
  check(res.status === 500 && allergies.filter((a) => a.child_id === chloeId).map((a) => a.name).join() === "Milk", "failed allergy save keeps the old allergies");
  ALLERGEN_NAMES.push("Sesame");

  check((await put("allergies", { allergens: ["bacon"] })).status === 400, "unknown allergy is rejected");
  check((await put("allergies", { allergens: ["egg"] }, otherParent)).status === 404, "another parent cannot change the allergies");

  res = await put("daily-limit", { dailyLimitCents: 850 });
  check(res.status === 200 && profiles.find((p) => p.child_id === chloeId).daily_limit === 8.5, "daily limit saved");
  for (const bad of [99, 5001, "800", 7.5])
    check((await put("daily-limit", { dailyLimitCents: bad })).status === 400, `limit ${JSON.stringify(bad)} is rejected`);
  check((await put("daily-limit", { dailyLimitCents: 800 }, otherParent)).status === 404, "another parent cannot change the limit");
  check((await put("daily-limit", { dailyLimitCents: 800 }, kidToken)).status === 403, "kid cannot change the limit");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
