// PIN lockout + parent reset tests
// fake in-memory database, no Supabase needed

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const users = [
  { user_id: 10, role: "child", is_active: true, username: "ethan", password_hash: bcrypt.hashSync("1234", 4), failed_pin_tries: 0, locked_until: null },
  { user_id: 12, role: "child", is_active: true, username: "chloe", password_hash: bcrypt.hashSync("1234", 4), failed_pin_tries: 0, locked_until: null },
];
const childProfiles = [
  { child_id: 10, parent_id: 1 },
  { child_id: 12, parent_id: 2 },
];

// ---------- fake database ----------

const isLocked = (u) => !!u.locked_until && u.locked_until > new Date();
const byId = (id) => users.find((u) => u.user_id === id);
const lockSecs = (u) => (isLocked(u) ? Math.ceil((u.locked_until - Date.now()) / 1000) : 0);

function fakeQuery(sql, params = []) {
  if (sql.includes("FROM child_profiles")) {
    const [childId, parentId] = params;
    return { rows: childProfiles.filter((c) => c.child_id === childId && c.parent_id === parentId) };
  }

  if (sql.includes("LOWER(username)")) {
    const u = users.find((x) => x.role === "child" && x.is_active && x.username === params[0].toLowerCase());
    return { rows: u ? [{ ...u, locked: isLocked(u), lock_seconds: lockSecs(u) }] : [] };
  }

  if (sql.includes("failed_pin_tries + 1")) {
    const [id, max, mins] = params;
    const u = byId(id);
    if (u.failed_pin_tries + 1 >= max) {
      u.failed_pin_tries = 0;
      u.locked_until = new Date(Date.now() + mins * 60000);
    } else {
      u.failed_pin_tries++;
    }
    return { rows: [{ failed_pin_tries: u.failed_pin_tries, locked: isLocked(u), lock_seconds: lockSecs(u) }] };
  }

  if (sql.includes("SET failed_pin_tries = 0 WHERE")) {
    byId(params[0]).failed_pin_tries = 0;
    return { rows: [] };
  }

  if (sql.includes("UPDATE users SET password_hash")) {
    const [hash, id] = params;
    Object.assign(byId(id), { password_hash: hash, failed_pin_tries: 0, locked_until: null });
    return { rows: [] };
  }

  return { rows: [] };
}

const fakePool = {
  query: async (sql, params) => fakeQuery(sql, params),
  connect: async () => ({ query: async (sql, params) => fakeQuery(sql, params), release() {} }),
};

const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent1 = tokenFor(1, "parent");
const parent2 = tokenFor(2, "parent");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const login = (username, pin) => request(app).post("/api/auth/child-login").send({ username, pin });
const setPin = (token, childId, pin) =>
  request(app).put(`/api/children/${childId}/pin`).set("Authorization", token).send({ pin });

// ---------- tests ----------

async function run() {
  let res;

  // wrong tries reset after a good login
  await login("ethan", "0000");
  await login("ethan", "0000");
  check(users[0].failed_pin_tries === 2, "wrong PINs are counted");
  res = await login("ethan", "1234");
  check(res.status === 200 && users[0].failed_pin_tries === 0, "right PIN resets the count");

  // 5 wrong tries locks
  for (let i = 0; i < 4; i++) res = await login("ethan", "0000");
  check(res.status === 401 && res.body.attemptsLeft === 1, "4 wrong tries is still just wrong PIN, 1 try left");
  res = await login("ethan", "0000");
  check(res.status === 423 && res.body.lockSeconds > 890 && res.body.lockSeconds <= 900, "5th wrong try locks the kid for 15 min");

  res = await login("ethan", "1234");
  check(res.status === 423 && res.body.lockSeconds > 0, "right PIN doesn't work while locked, still shows time left");

  res = await login("chloe", "1234");
  check(res.status === 200, "other kids are not locked");

  res = await login("nobody", "0000");
  check(res.status === 404, "unknown username says no account");

  // lock runs out
  users[0].locked_until = new Date(Date.now() - 1000);
  res = await login("ethan", "1234");
  check(res.status === 200, "kid can log in after the lock runs out");

  // parent reset unlocks
  for (let i = 0; i < 5; i++) await login("ethan", "0000");
  check(isLocked(users[0]), "locked again after 5 more wrong tries");

  res = await setPin(parent2, 10, "4321");
  check(res.status === 404 && isLocked(users[0]), "other parent can't reset or unlock");

  res = await setPin(parent1, 10, "4321");
  check(res.status === 200 && !isLocked(users[0]), "parent resetting the PIN unlocks the kid");
  check(users[0].password_hash.startsWith("$2"), "new PIN is a bcrypt hash");

  res = await login("ethan", "1234");
  check(res.status === 401, "old PIN no longer works");
  res = await login("ethan", "4321");
  check(res.status === 200, "kid logs in with the new PIN");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
