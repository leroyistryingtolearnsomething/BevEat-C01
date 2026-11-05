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

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
