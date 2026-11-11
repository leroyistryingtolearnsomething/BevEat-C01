// Home "Today's yummiest pics" and See all (GET /api/home/pics): the same dish cards as the stall menu.
// The models and Raghav's menu service are swapped for fakes, so no Supabase is needed.
// Run with: npm test

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database

const jwt = require("jsonwebtoken");
const request = require("supertest");

const fake = (path, exports) => {
  const p = require.resolve(path);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

// most hearts first: item 3, then 1, then 2 (2 has sold out today)
const topPics = [{ item_id: 3 }, { item_id: 1 }, { item_id: 2 }];
let picLimit = null;
fake("../gabriel/models/homeModel", {
  getTopPics: async (_childId, limit) => { picLimit = limit; return topPics; },
});
fake("../raghav/models/menuModel", {
  // the DB returns them in any order, and leaves out the sold-out dish
  getAvailableDishesByIds: async (ids) => ids.filter((id) => id !== 2).map((id) => ({ item_id: id })),
});
fake("../raghav/services/menuService", {
  loadChildContext: async (childId) => (childId === 10 ? { childId } : null),
  buildDishCards: async (rows) => rows.map((r) => ({ card: { id: r.item_id, status: r.item_id === 1 ? "blocked_allergy" : "allowed" } })),
});

const express = require("express");
const app = express();
app.use("/api", require("../gabriel/routes/homeRoutes"));

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

async function run() {
  let res = await request(app).get("/api/home/pics").set("Authorization", tokenFor(10, "child"));
  check(res.status === 200 && res.body.pics.map((p) => p.id).join() === "3,1", "See all keeps most-hearts order and drops sold-out dishes");
  check(res.body.pics[1].status === "blocked_allergy", "pics carry the menu's lock status");
  check(picLimit === 50, "See all asks for up to 50 pics");

  res = await request(app).get("/api/home/pics").set("Authorization", tokenFor(99, "child"));
  check(res.status === 200 && res.body.pics.length === 0, "no child profile gives no pics");
  check((await request(app).get("/api/home/pics").set("Authorization", tokenFor(1, "parent"))).status === 403, "parents can't use it");
  check((await request(app).get("/api/home/pics")).status === 401, "not logged in is rejected");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
