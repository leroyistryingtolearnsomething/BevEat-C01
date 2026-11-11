// Ask Mum endpoint tests (Raghav)
// Uses the fake database (test/fixtures/raghavMenuDb.js) and the in-memory Ask Mum mock.
// Leroy's food rules and his approve/deny endpoint don't exist yet, so this test swaps in a rule
// and uses the mock's helpers to stand in for Mum's decision.
// Run with: npm test   (or just this file: node test/askMum.test.js)

process.env.JWT_SECRET = "test-secret";
process.env.ASK_MUM_MEMORY = "1"; // in-memory Ask Mum store (raghav/models/askMumModel.memory.js), no database

const jwt = require("jsonwebtoken");
const request = require("supertest");
const db = require("./fixtures/raghavMenuDb");

db.install();
const app = require("../server");
const Teammates = require("../raghav/services/teammates");
const AskMum = require("../raghav/models/askMumModel");

const tokenFor = (id, role = "child") => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const CHLOE = 4; // allergic to Egg
const ETHAN = 3;
const MILO = 10; // Milk, Soy, Wheat: fine for Chloe's allergy, but Mum blocks it below
const EGG_PRATA = 8; // has Egg: an allergy block for Chloe
const CHICKEN_RICE = 1; // allowed for Chloe

// Mum (Chloe's parent) has a rule against Milo AND against Egg Prata
Teammates.getFoodRules = async (childId) =>
  childId === CHLOE
    ? [
        { type: "blocked_item", itemId: MILO, label: "No Milo on school days" },
        { type: "blocked_item", itemId: EGG_PRATA, label: "No prata today" },
      ]
    : [];

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const ask = (body, childId = CHLOE, role = "child") =>
  request(app).post("/api/ask-mum").set("Authorization", tokenFor(childId, role)).send(body);
const status = (itemId, childId = CHLOE) =>
  request(app).get(`/api/ask-mum/${itemId}`).set("Authorization", tokenFor(childId));
const miloOnMenu = async (childId = CHLOE) => {
  const res = await request(app).get("/api/stalls/4/menu?view=all").set("Authorization", tokenFor(childId));
  return res.body.dishes.find((d) => d.id === MILO);
};

async function run() {
  let res;
  AskMum.mockReset();

  // ----- nothing asked yet -----
  res = await status(MILO);
  check(res.status === 200 && res.body.request === null, "GET before asking: request is null");
  check((await miloOnMenu()).status === "blocked_parent", "Milo starts locked by Mum's rule");

  // ----- ask -----
  res = await ask({ itemId: MILO });
  check(res.status === 201 && res.body.status === "pending" && Number.isInteger(res.body.requestId),
    "Ask Mum about a Mum-blocked dish: 201 pending");
  const firstId = res.body.requestId;

  res = await status(MILO);
  check(res.body.request && res.body.request.requestId === firstId && res.body.request.status === "pending",
    "GET shows the pending request, so 05b shows 'Sent' again");

  // ----- one request per child per dish per day, whatever the answer -----
  res = await ask({ itemId: MILO });
  check(res.status === 200 && res.body.requestId === firstId, "asking again while pending returns the same request (no new ping)");

  AskMum.mockDecide(firstId, "denied");
  res = await ask({ itemId: MILO });
  check(res.status === 200 && res.body.requestId === firstId && res.body.status === "denied",
    "after Mum says no, asking again the same day returns the denied request (no spamming Mum)");
  check((await miloOnMenu()).status === "blocked_parent", "a denied request keeps the dish locked");

  // ----- Mum says yes: allowed today only -----
  AskMum.mockDecide(firstId, "approved");
  const milo = await miloOnMenu();
  check(milo.status === "allowed" && milo.askMumApproved === true, "Mum's yes unlocks the dish today, flagged askMumApproved");
  res = await request(app).get(`/api/menu-items/${MILO}`).set("Authorization", tokenFor(CHLOE));
  check(res.body.dish.status === "allowed" && res.body.dish.addOns.length > 0, "approved dish's food detail now has its add-ons");
  check((await miloOnMenu(ETHAN)).askMumApproved === undefined, "Chloe's approval doesn't touch another child's menu");

  AskMum.mockSetDate(firstId, "2020-01-01"); // the approval is from an earlier day
  check((await miloOnMenu()).status === "blocked_parent", "yesterday's yes doesn't count: locked again ('just this once')");
  res = await ask({ itemId: MILO });
  check(res.status === 201 && res.body.requestId !== firstId, "a new day allows one new request");

  // ----- Ask Mum can never unlock an allergy -----
  res = await ask({ itemId: EGG_PRATA });
  check(res.status === 409 && res.body.error === "Ask Mum can't unlock allergies",
    "asking about an allergy dish is refused with 409, even when Mum also has a rule for it");

  const sneaky = await AskMum.create(CHLOE, EGG_PRATA); // pretend a request got approved anyway
  AskMum.mockDecide(sneaky.request_id, "approved");
  res = await request(app).get("/api/stalls/3/menu?view=all").set("Authorization", tokenFor(CHLOE));
  check(res.body.dishes.find((d) => d.id === EGG_PRATA).status === "blocked_allergy",
    "even an approved request leaves an allergy dish locked");

  res = await ask({ itemId: CHICKEN_RICE });
  check(res.status === 409 && res.body.error === "This dish isn't locked", "asking about an allowed dish gives 409");

  // ----- two taps at the same moment -----
  AskMum.mockReset();
  const [a, b] = await Promise.all([ask({ itemId: MILO }), ask({ itemId: MILO })]);
  check([a.status, b.status].sort().join() === "200,201" && a.body.requestId === b.body.requestId,
    "two taps at once: one 201, one 200, both the same request");

  // ----- validation and access -----
  for (const body of [{}, { itemId: "10" }, { itemId: 0 }, { itemId: -3 }, { itemId: 1.5 }, { itemId: true }, { itemId: [10] }]) {
    res = await ask(body);
    check(res.status === 400 && res.body.error === "Invalid dish id", `body ${JSON.stringify(body)} gives 400`);
  }
  res = await ask({ itemId: 999 });
  check(res.status === 404 && res.body.error === "Dish not found", "unknown dish gives 404");
  res = await status("abc");
  check(res.status === 400, "GET with a bad id gives 400");
  res = await status(MILO, ETHAN);
  check(res.body.request === null, "a child only ever sees their own requests");
  res = await ask({ itemId: MILO }, 1, "parent");
  check(res.status === 403, "a parent can't use the kid's Ask Mum endpoint");
  res = await request(app).post("/api/ask-mum").send({ itemId: MILO });
  check(res.status === 401, "not logged in gives 401");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
