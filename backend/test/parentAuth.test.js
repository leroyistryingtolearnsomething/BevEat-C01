// Parent sign up and log in tests
// Uses a fake in-memory database, so no Supabase connection is needed.
// Run with: npm test

process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const users = [
  { user_id: 1, role: "parent", is_active: true, display_name: "Sarah Tan", email: "sarah@example.com", password_hash: bcrypt.hashSync("secret123", 4) },
  { user_id: 2, role: "parent", is_active: false, display_name: "Old", email: "old@example.com", password_hash: bcrypt.hashSync("secret123", 4) },
];

// ---------- fake database ----------

const fakePool = {
  query: async (sql, params = []) => {
    if (sql.includes("INSERT INTO users")) {
      const [display_name, email, phone, password_hash] = params;
      if (users.some((u) => u.email === email)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      const row = { user_id: users.length + 1, role: "parent", is_active: true, display_name, email, phone, password_hash };
      users.push(row);
      return { rows: [row] };
    }
    return sql.includes("LOWER(email)")
      ? { rows: users.filter((u) => u.role === "parent" && u.is_active && u.email === params[0].toLowerCase()) }
      : { rows: [] };
  },
};

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

const login = (body) => request(app).post("/api/auth/parent-login").send(body);
const signup = (body) => request(app).post("/api/auth/parent-signup").send(body);

// ---------- tests ----------

async function run() {
  let res;

  res = await login({ email: "sarah@example.com", password: "secret123" });
  const payload = res.body.token && jwt.verify(res.body.token, process.env.JWT_SECRET);
  check(res.status === 200 && res.body.parent.id === 1 && res.body.parent.name === "Sarah Tan", "parent logs in with the right password");
  check(payload && payload.id === 1 && payload.role === "parent", "token says who the parent is");
  check(!("password_hash" in res.body.parent), "password hash is not sent back");

  res = await login({ email: " SARAH@example.com ", password: "secret123" });
  check(res.status === 200, "email is not case sensitive");

  res = await login({ email: "sarah@example.com", password: "wrong" });
  check(res.status === 401, "wrong password is rejected");

  res = await login({ email: "nobody@example.com", password: "secret123" });
  check(res.status === 401, "unknown email is rejected");

  res = await login({ email: "old@example.com", password: "secret123" });
  check(res.status === 401, "inactive parent cannot log in");

  res = await login({});
  check(res.status === 400, "missing email or password is rejected");

  // sign up
  const newParent = { name: "Mei Ling", mobile: "+6591234567", email: " Mei@Example.com ", password: "noodles88" };
  res = await signup(newParent);
  const added = users.at(-1);
  check(res.status === 201 && res.body.token && res.body.parent.name === "Mei Ling", "parent signs up and gets a token");
  check(added.email === "mei@example.com" && added.phone === "+6591234567", "email saved lower case, mobile saved");
  check(added.password_hash !== "noodles88" && bcrypt.compareSync("noodles88", added.password_hash), "password saved as a bcrypt hash");
  check(!("password_hash" in res.body.parent), "sign up does not send the hash back");

  res = await login({ email: "mei@example.com", password: "noodles88" });
  check(res.status === 200, "new parent can log in");

  res = await signup({ ...newParent, email: "MEI@example.com" });
  check(res.status === 409, "same email again is rejected");

  for (const [field, bad] of [["name", " "], ["mobile", "91234567"], ["mobile", "+6561234567"], ["email", "nope"], ["password", "short1"], ["password", "nonumbers"]])
    check((await signup({ ...newParent, email: "x@example.com", [field]: bad })).status === 400, `bad ${field} ${JSON.stringify(bad)} is rejected`);

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
