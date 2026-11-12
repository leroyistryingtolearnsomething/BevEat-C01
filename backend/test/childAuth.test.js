// Child login tests (PB02)
// Uses a fake in-memory database, so no Supabase connection is needed.
// Run with: npm test

process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const users = [
  { user_id: 1, role: "parent", is_active: true },
  { user_id: 2, role: "parent", is_active: true },
  {
    user_id: 10,
    role: "child",
    is_active: true,
    username: "ethan",
    display_name: "Ethan",
    avatar_emoji: "🐼",
    password_hash: bcrypt.hashSync("1234", 4),
  },
  {
    user_id: 11,
    role: "child",
    is_active: false,
    username: "olduser",
    password_hash: bcrypt.hashSync("1234", 4),
  },
];

const childProfiles = [{ child_id: 10, parent_id: 1 }];

// ---------- fake database ----------

function fakeQuery(sql, params = []) {
  if (sql.includes("FROM child_profiles")) {
    const [childId, parentId] = params;
    return {
      rows: childProfiles.filter((c) => c.child_id === childId && c.parent_id === parentId),
    };
  }

  if (sql.includes("LOWER(username)")) {
    const name = params[0].toLowerCase();
    return {
      rows: users.filter((u) => u.role === "child" && u.is_active && u.username === name),
    };
  }

  if (sql.includes("UPDATE users SET password_hash")) {
    const [hash, userId] = params;
    users.find((u) => u.user_id === userId).password_hash = hash;
    return { rows: [] };
  }

  return { rows: [] };
}

const fakePool = {
  query: async (sql, params) => fakeQuery(sql, params),
  connect: async () => ({ query: async (sql, params) => fakeQuery(sql, params), release() {} }),
};

// swap the real db.js for the fake one before the app loads
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent1 = tokenFor(1, "parent"); // Ethan's parent
const parent2 = tokenFor(2, "parent"); // someone else's parent

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const login = (username, pin) =>
  request(app).post("/api/auth/child-login").send({ username, pin });

const setPin = (token, pin) => {
  const req = request(app).put("/api/children/10/pin").send({ pin });
  return token ? req.set("Authorization", token) : req;
};

// ---------- tests ----------

async function run() {
  let res;

  // logging in
  res = await login("ethan", "1234");
  check(res.status === 200 && res.body.token && res.body.child.id === 10, "kid logs in with the right PIN");
  const kid = "Bearer " + res.body.token;

  res = await login("ETHAN", "1234");
  check(res.status === 200, "username is not case sensitive");

  res = await login("ethan", "9999");
  check(res.status === 401, "wrong PIN is rejected");

  res = await login("nobody", "1234");
  check(res.status === 404, "unknown username says no account");

  res = await request(app).post("/api/auth/child-login").send({});
  check(res.status === 400, "missing username or PIN is rejected");

  res = await login("olduser", "1234");
  check(res.status === 404, "inactive kid cannot log in");

  // parent setting the PIN
  res = await setPin(parent1, "5678");
  check(res.status === 200, "parent can set their own kid's PIN");
  check(users[2].password_hash.startsWith("$2"), "PIN is saved as a bcrypt hash");

  res = await login("ethan", "5678");
  check(res.status === 200, "kid can log in with the new PIN");

  res = await setPin(parent1, "12");
  check(res.status === 400, "PIN shorter than 4 digits is rejected");

  res = await setPin(parent2, "1111");
  check(res.status === 404, "another parent cannot set the PIN");

  res = await setPin(kid, "1111");
  check(res.status === 403, "kid cannot set a PIN");

  res = await setPin(null, "1111");
  check(res.status === 401, "not logged in is rejected");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
