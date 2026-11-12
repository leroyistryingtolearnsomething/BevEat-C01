// POST /api/checkout: pays for the tray from the wallet, one order per stall, all in one transaction.
// priceTray and the money lookup are replaced with fakes, and the database with a recording client,
// so no Supabase connection is needed. Run with: npm test

process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fakes ----------

const realTray = require("../raghav/services/trayPricing");
const line = (itemId, stallId, name, price, addOns = []) => ({
  itemId, stallId, name, quantity: 1, unitPrice: price, addOns, macros: { calories: 400, proteinG: 10, carbsG: 50, fatG: 8 },
});
const stallA = { stallId: 1, stallName: "Ah Ma Rice", subtotal: 3.5, lines: [line(1, 1, "Chicken rice", 3, [{ id: 7, name: "Egg", extraPrice: 0.5 }])] };
const stallB = { stallId: 2, stallName: "Uncle Lim Drinks", subtotal: 1.5, lines: [line(2, 2, "Milo", 1.5)] };

let pricing; // what the fake priceTray does this time
const fakePricing = { ...realTray, priceTray: async () => pricing() };
const pricingPath = require.resolve("../raghav/services/trayPricing");
require.cache[pricingPath] = { id: pricingPath, filename: pricingPath, loaded: true, exports: fakePricing };

let money = { leftToday: 10, walletBalance: 10 };
const moneyPath = require.resolve("../xinsheng/services/moneyService");
require.cache[moneyPath] = { id: moneyPath, filename: moneyPath, loaded: true, exports: { getMoneyToday: async () => money } };

let log, wallet, nextOrderId, nextItemId, failOn, queueBase;
const fakeClient = {
  query: async (sql, params = []) => {
    log.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
    if (failOn && sql.includes(failOn)) throw new Error("db broke");
    if (sql.includes("UPDATE child_profiles")) {
      if (wallet < params[0]) return { rowCount: 0, rows: [] };
      wallet = Math.round((wallet - params[0]) * 100) / 100;
      return { rowCount: 1, rows: [{ wallet_balance: wallet }] };
    }
    if (sql.includes("MAX(queue_number)")) return { rows: [{ n: queueBase[params[0]] }] };
    if (sql.includes("INSERT INTO orders")) return { rows: [{ order_id: nextOrderId++, queue_number: params[2] }] };
    if (sql.includes("INSERT INTO order_items")) return { rows: [{ order_item_id: nextItemId++ }] };
    return { rows: [], rowCount: 0 };
  },
  release: () => { log.push("RELEASE"); },
};
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { connect: async () => fakeClient, query: async () => ({ rows: [] }) } };

const app = require("../server");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const kid = tokenFor(10, "child");
const body = { items: [{ itemId: 1, quantity: 1, addOnIds: [7] }, { itemId: 2, quantity: 1, addOnIds: [] }] };
const pay = (token = kid, b = body) => request(app).post("/api/checkout").set("Authorization", token).send(b);
const count = (word) => log.filter((l) => l.startsWith(word)).length;

function reset() {
  log = []; wallet = 10; nextOrderId = 100; nextItemId = 500; failOn = null; queueBase = { 1: 4, 2: 1 };
  money = { leftToday: 10, walletBalance: 10 };
  pricing = () => ({ stalls: [stallA, stallB], total: 5, canPay: true, money: { shortBy: 0 } });
}

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

// ---------- tests ----------

async function run() {
  reset();
  let res = await pay();
  check(res.status === 201, "a kid can pay for a tray");
  check(res.body.orders.length === 2 && res.body.orders[0].stallName === "Ah Ma Rice" && res.body.orders[1].stallId === 2, "one order per stall");
  check(res.body.orders[0].queueNumber === 4 && res.body.orders[1].queueNumber === 1, "each order has its own queue number from its stall");
  check(res.body.orders[0].total === 3.5 && res.body.orders[1].total === 1.5 && res.body.total === 5, "order totals add up to the tray total");
  check(res.body.walletBalance === 5 && wallet === 5, "the wallet is charged once, for the whole tray");
  check(count("UPDATE") === 1 && count("INSERT") === 2 + 2 + 1, "2 orders, 2 dishes and 1 add-on were saved");
  check(log[0] === "BEGIN" && log.includes("COMMIT") && !log.includes("ROLLBACK") && log.at(-1) === "RELEASE", "it is one transaction that commits and gives the connection back");

  reset();
  pricing = () => ({ stalls: [stallA, stallB], total: 5, canPay: false, money: { shortBy: 2 } });
  res = await pay();
  check(res.status === 409 && res.body.shortBy === 2 && log.length === 0, "not enough money by the quote: 409, the database is never touched");

  reset();
  money = { leftToday: 3, walletBalance: 10 };
  res = await pay();
  check(res.status === 409 && res.body.shortBy === 2 && wallet === 10, "money used up since the quote (two quick taps): 409 and nothing charged");
  check(log.includes("ROLLBACK") && count("INSERT") === 0 && log.at(-1) === "RELEASE", "...it rolls back and saves no order");

  reset();
  wallet = 2; // the guarded UPDATE is the last line of defence
  res = await pay();
  check(res.status === 409 && wallet === 2 && count("INSERT") === 0, "the wallet can never go below zero");

  reset();
  failOn = "INSERT INTO order_items";
  res = await pay();
  check(res.status === 500 && log.includes("ROLLBACK") && !log.includes("COMMIT"), "if saving fails halfway, everything is rolled back");

  reset();
  const { TrayError } = realTray;
  pricing = () => { throw new TrayError("locked", "Some food in your tray can't be ordered now", [{ itemId: 1, reason: "blocked_allergy" }]); };
  res = await pay();
  check(res.status === 409 && res.body.problems.length === 1 && log.length === 0, "a dish that is no longer allowed: 409 with the problems, nothing saved");

  reset();
  pricing = () => { throw new TrayError("no_child", "Child not found"); };
  check((await pay()).status === 404, "no child profile is 404");

  reset();
  res = await pay(kid, { items: [{ itemId: 1, quantity: 99, addOnIds: [] }] });
  check(res.status === 400 && log.length === 0, "a bad tray is 400");

  reset();
  pricing = () => { return { stalls: [stallA], total: 3.5, canPay: true, money: { shortBy: 0 } }; };
  res = await pay(kid, { items: [{ itemId: 1, quantity: 1, addOnIds: [], price: 0.01, total: 0.01 }], total: 0.01 });
  check(res.status === 201 && wallet === 6.5, "a price sent by the app is ignored: the server's price is charged");

  reset();
  check((await pay(tokenFor(1, "parent"))).status === 403, "a parent can't use the kid checkout");
  check((await request(app).post("/api/checkout").send(body)).status === 401, "not logged in is rejected");
  check(log.length === 0, "rejected calls never touch the database");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
