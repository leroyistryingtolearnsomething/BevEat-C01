// Ask Mum endpoint tests (Raghav)
// Uses the fake database (test/fixtures/raghavMenuDb.js), which answers the real askMumModel's
// SQL on ask_mum_requests, including the unique index's error. The test swaps in Mum's food
// rules, and uses the fixture's db.askMum helpers to stand in for Leslie's parent-side approve/deny.
// Run with: npm test   (or just this file: node test/askMum.test.js)

process.env.JWT_SECRET = "test-secret";

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
  db.askMum.reset();

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

  db.askMum.decide(firstId, "denied");
  res = await ask({ itemId: MILO });
  check(res.status === 200 && res.body.requestId === firstId && res.body.status === "denied",
    "after Mum says no, asking again the same day returns the denied request (no spamming Mum)");
  check((await miloOnMenu()).status === "blocked_parent", "a denied request keeps the dish locked");

  // ----- Mum says yes: allowed today only -----
  db.askMum.decide(firstId, "approved");
  const milo = await miloOnMenu();
  check(milo.status === "allowed" && milo.askMumApproved === true, "Mum's yes unlocks the dish today, flagged askMumApproved");
  res = await request(app).get(`/api/menu-items/${MILO}`).set("Authorization", tokenFor(CHLOE));
  check(res.body.dish.status === "allowed" && res.body.dish.addOns.length > 0, "approved dish's food detail now has its add-ons");
  check((await miloOnMenu(ETHAN)).askMumApproved === undefined, "Chloe's approval doesn't touch another child's menu");

  db.askMum.setDate(firstId, "2020-01-01"); // the approval is from an earlier day
  check((await miloOnMenu()).status === "blocked_parent", "yesterday's yes doesn't count: locked again ('just this once')");
  res = await ask({ itemId: MILO });
  check(res.status === 201 && res.body.requestId !== firstId, "a new day allows one new request");

  // ----- Ask Mum can never unlock an allergy -----
  res = await ask({ itemId: EGG_PRATA });
  check(res.status === 409 && res.body.error === "Ask Mum can't unlock allergies",
    "asking about an allergy dish is refused with 409, even when Mum also has a rule for it");

  const sneaky = await AskMum.create(CHLOE, EGG_PRATA); // pretend a request got approved anyway
  db.askMum.decide(sneaky.request_id, "approved");
  res = await request(app).get("/api/stalls/3/menu?view=all").set("Authorization", tokenFor(CHLOE));
  check(res.body.dishes.find((d) => d.id === EGG_PRATA).status === "blocked_allergy",
    "even an approved request leaves an allergy dish locked");

  res = await ask({ itemId: CHICKEN_RICE });
  check(res.status === 409 && res.body.error === "This dish isn't locked", "asking about an allowed dish gives 409");

  // ----- two taps at the same moment -----
  db.askMum.reset();
  const [a, b] = await Promise.all([ask({ itemId: MILO }), ask({ itemId: MILO })]);
  check([a.status, b.status].sort().join() === "200,201" && a.body.requestId === b.body.requestId,
    "two taps at once: one 201, one 200, both the same request");

  // The exact race: the second tap's "did I ask today?" check runs before the first tap's row
  // lands, so it tries to INSERT too. The unique index refuses it (23505) and the kid gets the
  // first request back, not an error, and Mum gets only one ping.
  db.askMum.hideNextLookup();
  res = await ask({ itemId: MILO });
  check(res.status === 200 && res.body.requestId === a.body.requestId,
    "unique index hit (already asked today): 200 with the existing request");
  check(db.askMum.rows().filter((r) => r.child_id === CHLOE && r.item_id === MILO).length === 1,
    "...and there is still only one row");

  // ----- the real SQL -----
  const askMumSql = db.state.queries.filter((q) => q.sql.includes("ask_mum_requests"));
  check(askMumSql.length > 0 && askMumSql.every((q) => !/\b(4|10)\b/.test(q.sql) && q.params.length > 0),
    "ask_mum_requests queries pass the child and dish as $ parameters, never in the SQL text");
  check(askMumSql.every((q) => q.sql.includes("(now() AT TIME ZONE 'Asia/Singapore')::date") || q.sql.includes("INSERT")),
    "'today' is the Singapore day, worked out by the database");

  // ----- fail closed: approvals can't load -----
  db.askMum.decide(a.body.requestId, "approved");
  db.state.failAskMum = true;
  const realError = console.error;
  console.error = () => {}; // keep the server's expected error log out of the test output
  res = await request(app).get("/api/stalls/4/menu?view=all").set("Authorization", tokenFor(CHLOE));
  console.error = realError;
  check(res.status === 500 && !res.body.dishes, "if Mum's approvals can't be read, the menu is a 500, not a guess");
  db.state.failAskMum = false;

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

  // ----- the kid's note for Mum (ask_mum_requests.child_note, schema request #11) -----
  const rowsFor = () => db.askMum.rows().filter((r) => r.child_id === CHLOE && r.item_id === MILO);

  db.askMum.reset();
  res = await ask({ itemId: MILO, note: "  I'm extra hungry today  " });
  check(res.status === 201 && res.body.note === "I'm extra hungry today", "a note is saved, trimmed, and sent back");
  check(rowsFor()[0].child_note === "I'm extra hungry today", "...it's written to child_note (what Leslie's parent screen shows)");
  res = await status(MILO);
  check(res.body.request.note === "I'm extra hungry today", "GET returns the note, so 05b's 'Sent' state shows it again");
  res = await ask({ itemId: MILO, note: "Pleeease" });
  check(res.status === 200 && res.body.note === "I'm extra hungry today" && rowsFor().length === 1,
    "asking again the same day returns the ORIGINAL note; the new one is ignored");

  for (const [label, note] of [["missing", undefined], ["null", null], ['""', ""], ['"   " (only spaces)', "   "]]) {
    db.askMum.reset();
    res = await ask(note === undefined ? { itemId: MILO } : { itemId: MILO, note });
    check(res.status === 201 && res.body.note === null && rowsFor()[0].child_note === null, `note ${label}: 201, saved as null`);
  }

  db.askMum.reset();
  res = await ask({ itemId: MILO, note: "a".repeat(100) });
  check(res.status === 201 && res.body.note.length === 100, "exactly 100 characters is allowed");
  db.askMum.reset();
  res = await ask({ itemId: MILO, note: "🍕".repeat(100) });
  check(res.status === 201 && [...res.body.note].length === 100,
    "100 emoji is allowed (counted as characters, like Postgres char_length, not JS .length 200)");

  const badNotes = [
    ["101 characters", "a".repeat(101)], ["101 emoji", "🍕".repeat(101)], ["a newline", "\n"],
    ["a line break inside", "hi\nMum"], ["a tab", "hi\tMum"], ["a bell character", "\u0007"],
    ["a number", 123], ["true", true], ["an object", { text: "hi" }], ["a list", ["hi"]],
  ];
  for (const [label, note] of badNotes) {
    db.askMum.reset();
    const queriesBefore = db.state.queries.length;
    res = await ask({ itemId: MILO, note });
    check(res.status === 400 && typeof res.body.error === "string" && rowsFor().length === 0 &&
      db.state.queries.length === queriesBefore, `note ${label}: 400, no request, and no database call at all`);
  }
  res = await ask({ itemId: "10", note: 123 });
  check(res.status === 400 && res.body.error === "Invalid dish id", "a bad dish id is still reported first");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
