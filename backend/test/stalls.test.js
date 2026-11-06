// Stall discovery tests (Raghav)
// Uses a fake in-memory database, so no Supabase connection is needed.
// Run with: npm test   (or just this file: node test/stalls.test.js)

process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data (same 5 stalls as the real seed) ----------

const stalls = [
  { stall_id: 1, name: "Lim's Chicken Rice", unit_no: "#01-05", cuisine: "Chinese", is_halal: false, description: "Chicken rice, char siew rice and noodles", year_started: 1988, is_open: true, avg_prep_minutes: 4, cover_image_url: null },
  { stall_id: 2, name: "Mariam Nasi Lemak", unit_no: "#01-08", cuisine: "Malay", is_halal: true, description: "Nasi lemak, mee goreng and noodle soups", year_started: 2002, is_open: true, avg_prep_minutes: 5, cover_image_url: "https://example.com/mariam.jpg" },
  { stall_id: 3, name: "Kumar's Prata Corner", unit_no: "#01-12", cuisine: "Indian", is_halal: true, description: "Prata, thosai, briyani and roti john", year_started: 1995, is_open: true, avg_prep_minutes: 6, cover_image_url: null },
  { stall_id: 4, name: "Wong's Drinks & Desserts", unit_no: "#01-15", cuisine: "Drinks", is_halal: false, description: "Cold drinks, chendol and ice kacang", year_started: 1983, is_open: true, avg_prep_minutes: 3, cover_image_url: null },
  { stall_id: 5, name: "Hakim's Western Grill", unit_no: "#01-18", cuisine: "Western", is_halal: true, description: "Chicken chop, fish & chips and pasta", year_started: 2009, is_open: false, avg_prep_minutes: 7, cover_image_url: null },
];

// ---------- fake database ----------

const queries = []; // every query the app sends, so we can check it is parameterised

function fakeQuery(sql, params = []) {
  queries.push({ sql, params });

  if (sql.includes("FROM stalls WHERE stall_id = $1")) {
    return { rows: stalls.filter((s) => s.stall_id === params[0]) };
  }

  if (sql.includes("FROM stalls")) {
    // mirrors the SQL: ($1 IS NULL OR cuisine = $1) AND ($2 IS NULL OR is_halal = $2)
    const [cuisine, halal] = params;
    const rows = stalls
      .filter((s) => cuisine === null || s.cuisine === cuisine)
      .filter((s) => halal === null || s.is_halal === halal)
      .sort((a, b) => b.is_open - a.is_open || a.name.localeCompare(b.name));
    return { rows };
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
const kid = tokenFor(10, "child");
const parent = tokenFor(1, "parent");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const get = (path, token = kid) => {
  const req = request(app).get(path);
  return token ? req.set("Authorization", token) : req;
};
const ids = (res) => (res.body.stalls || []).map((s) => s.id);

// ---------- tests ----------

async function run() {
  let res;

  // listing
  res = await get("/api/stalls");
  check(res.status === 200 && res.body.stalls.length === 5, "lists all 5 stalls");
  const lim = res.body.stalls.find((s) => s.id === 1);
  check(
    lim && lim.name === "Lim's Chicken Rice" && lim.unitNo === "#01-05" && lim.cuisine === "Chinese" &&
      lim.isHalal === false && lim.yearStarted === 1988 && lim.isOpen === true && lim.prepMinutes === 4 &&
      typeof lim.description === "string",
    "stall has the agreed camelCase fields"
  );
  check(lim && lim.coverImageUrl === null, "stall with no cover gets coverImageUrl null");
  check(res.body.stalls.find((s) => s.id === 2).coverImageUrl === "https://example.com/mariam.jpg", "stall with a cover keeps it");
  check(ids(res)[4] === 5, "closed stall is listed last");

  res = await get("/api/stalls", parent);
  check(res.status === 200 && res.body.stalls.length === 5, "parents can browse stalls too");

  // cuisine filter
  res = await get("/api/stalls?cuisine=Malay");
  check(res.status === 200 && ids(res).join() === "2", "cuisine=Malay returns only the Malay stall");

  res = await get("/api/stalls?cuisine=malay");
  check(res.status === 200 && ids(res).join() === "2", "cuisine filter ignores upper/lower case");

  for (const cuisine of ["Chinese", "Malay", "Indian", "Western", "Drinks"]) {
    res = await get(`/api/stalls?cuisine=${cuisine}`);
    check(res.status === 200 && res.body.stalls.length > 0 && res.body.stalls.every((s) => s.cuisine === cuisine),
      `cuisine=${cuisine} returns only ${cuisine} stalls`);
  }

  // halal filter
  res = await get("/api/stalls?halal=true");
  check(res.status === 200 && ids(res).sort().join() === "2,3,5", "halal=true returns only halal stalls");
  check(res.body.stalls.every((s) => s.isHalal === true), "every stall from halal=true is halal");

  res = await get("/api/stalls?cuisine=Drinks&halal=true");
  check(res.status === 200 && Array.isArray(res.body.stalls) && res.body.stalls.length === 0,
    "no match gives 200 with an empty list");

  res = await get("/api/stalls?cuisine=Indian&halal=true");
  check(res.status === 200 && ids(res).join() === "3", "cuisine and halal filters combine");

  // bad query params
  res = await get("/api/stalls?cuisine=Japanese");
  check(res.status === 400 && /Unknown cuisine/.test(res.body.error), "unknown cuisine is rejected with 400");

  res = await get("/api/stalls?cuisine=" + encodeURIComponent("Chinese'; DROP TABLE stalls;--"));
  check(res.status === 400, "SQL injection attempt in cuisine is rejected with 400");

  res = await get("/api/stalls?cuisine=");
  check(res.status === 400, "empty cuisine is rejected with 400");

  res = await get("/api/stalls?cuisine=Malay&cuisine=Indian");
  check(res.status === 400, "repeated cuisine param is rejected with 400");

  for (const halal of ["yes", "false", "1"]) {
    res = await get(`/api/stalls?halal=${halal}`);
    check(res.status === 400 && res.body.error, `halal=${halal} is rejected with 400`);
  }

  // single stall
  res = await get("/api/stalls/2");
  check(res.status === 200 && res.body.stall.id === 2 && res.body.stall.name === "Mariam Nasi Lemak", "gets one stall by id");

  res = await get("/api/stalls/1");
  check(res.status === 200 && res.body.stall.coverImageUrl === null, "GET /stalls/:id gives coverImageUrl null when there is no cover");

  res = await get("/api/stalls/999");
  check(res.status === 404 && res.body.error === "Stall not found", "unknown stall id gives 404");

  for (const badId of ["abc", "0", "-1", "1.5"]) {
    res = await get(`/api/stalls/${badId}`);
    check(res.status === 400 && res.body.error === "Invalid stall id", `stall id "${badId}" is rejected with 400`);
  }

  // auth
  res = await get("/api/stalls", null);
  check(res.status === 401, "not logged in cannot list stalls");

  res = await get("/api/stalls/1", null);
  check(res.status === 401, "not logged in cannot get a stall");

  // parameterised SQL: user input must only ever appear in params, never in the SQL text
  queries.length = 0;
  await get("/api/stalls?cuisine=indian&halal=true");
  await get("/api/stalls/3");
  check(queries.length === 2, "each request runs exactly one query");
  check(queries.every((q) => !/indian|Indian/.test(q.sql) && !/= 3\b/.test(q.sql)), "user input never appears in the SQL text");
  check(queries[0].params[0] === "Indian" && queries[0].params[1] === true && queries[1].params[0] === 3,
    "user input is passed as $ parameters");

  // an unexpected DB error gives the shared 500 JSON, not a crash
  const realQuery = fakePool.query;
  fakePool.query = async () => { throw new Error("db down (expected in this test)"); };
  const realError = console.error;
  console.error = () => {}; // keep the server's error log out of the test output
  res = await get("/api/stalls");
  console.error = realError;
  fakePool.query = realQuery;
  check(res.status === 500 && res.body.error === "Something went wrong", "database error gives 500 { error }");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
