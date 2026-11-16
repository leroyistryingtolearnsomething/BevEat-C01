// Weekday limits, spending report and low money alert tests
// fake in-memory database, no Supabase needed

process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");

// ---------- fake data ----------

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const sgNow = () => new Date(Date.now() + 8 * 3600 * 1000);
const todayIdx = sgNow().getUTCDay();
const today = DAYS[todayIdx];
const yesterday = DAYS[(todayIdx + 6) % 7];
const daysAgo = (n) => new Date(sgNow().getTime() - n * 86400000).toISOString().slice(0, 10);

// parent 1 has kids 10 + 11, parent 2 has kid 12
const kids = [
  { child_id: 10, parent_id: 1, display_name: "Ethan", wallet_balance: "3.00", daily_limit: "5.00", locked: false },
  { child_id: 11, parent_id: 1, display_name: "Chloe", wallet_balance: "20.00", daily_limit: "4.00", locked: true },
  { child_id: 12, parent_id: 2, display_name: "Aisyah", wallet_balance: "1.00", daily_limit: "5.00", locked: false },
];
// child_id -> { daysAgo: spent }
const spend = { 10: { 0: 4.2, 1: 7, 3: 2.5 }, 11: { 0: 4 }, 12: {} };
let dayLimits = []; // { child_id, weekday, daily_limit }
let limitHistory = []; // { child_id, changed_at, daily_limit, day_limits }
let walletAlerts = []; // { child_id, alert_below }

// ---------- fake database ----------

const kid = (id) => kids.find((k) => k.child_id === id);

function fakeQuery(sql, params = []) {
  if (sql.includes("SELECT child_id FROM child_profiles")) {
    const [childId, parentId] = params;
    return { rows: kids.filter((k) => k.child_id === childId && k.parent_id === parentId) };
  }

  if (sql.includes("WHERE u.user_id = $1")) {
    const k = kid(params[0]);
    return { rows: k ? [{ ...k, avatar_emoji: "🙂" }] : [] };
  }

  if (sql.includes("generate_series")) {
    const [childId, n] = params;
    const rows = [];
    for (let i = n - 1; i >= 0; i--) rows.push({ day: daysAgo(i), spent: String(spend[childId][i] || 0) });
    return { rows };
  }

  // Gabriel's getSpentToday
  if (sql.includes("SUM(total_amount), 0) AS spent")) return { rows: [{ spent: String(spend[params[0]][0] || 0) }] };

  if (sql.includes("WHERE c.parent_id = $1")) {
    return {
      rows: kids
        .filter((k) => k.parent_id === params[0])
        .map((k) => ({ ...k, avatar_emoji: "🙂", allergens: [], spent_today: String(spend[k.child_id][0] || 0) })),
    };
  }

  if (sql.includes("FROM child_limit_history")) {
    return { rows: limitHistory.filter((h) => h.child_id === params[0]) };
  }

  if (sql.includes("SELECT weekday, daily_limit FROM child_day_limits")) {
    return { rows: dayLimits.filter((d) => d.child_id === params[0]) };
  }
  if (sql.includes("FROM child_day_limits WHERE child_id = ANY")) {
    return { rows: dayLimits.filter((d) => params[0].includes(d.child_id)) };
  }
  if (sql.includes("DELETE FROM child_day_limits")) {
    dayLimits = dayLimits.filter((d) => d.child_id !== params[0]);
    return { rows: [] };
  }
  if (sql.includes("INSERT INTO child_day_limits")) {
    const [child_id, weekday, daily_limit] = params;
    dayLimits.push({ child_id, weekday, daily_limit: String(daily_limit) });
    return { rows: [] };
  }

  if (sql.includes("FROM child_wallet_alerts WHERE child_id = ANY")) {
    return { rows: walletAlerts.filter((w) => params[0].includes(w.child_id)) };
  }
  if (sql.includes("DELETE FROM child_wallet_alerts")) {
    walletAlerts = walletAlerts.filter((w) => w.child_id !== params[0]);
    return { rows: [] };
  }
  if (sql.includes("INSERT INTO child_wallet_alerts")) {
    walletAlerts = walletAlerts.filter((w) => w.child_id !== params[0]);
    walletAlerts.push({ child_id: params[0], alert_below: String(params[1]) });
    return { rows: [] };
  }

  if (sql.includes("locked_until > now()") && sql.includes("ANY")) {
    return { rows: kids.filter((k) => params[0].includes(k.child_id) && k.locked).map((k) => ({ user_id: k.child_id })) };
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
const { getMoneyToday } = require("../xinsheng/services/moneyService");

// ---------- helpers ----------

const tokenFor = (id, role) => "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET);
const parent1 = tokenFor(1, "parent");
const parent2 = tokenFor(2, "parent");
const kidToken = tokenFor(10, "child");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const get = (path, token) => request(app).get("/api" + path).set("Authorization", token);
const put = (path, token, body) => request(app).put("/api" + path).set("Authorization", token).send(body);
const typesFor = (alerts, childId) => alerts.filter((a) => a.childId === childId).map((a) => a.type).sort().join();

// ---------- tests ----------

async function run() {
  let res;

  // weekday limits
  res = await get("/children/10/day-limits", parent1);
  check(res.status === 200 && res.body.defaultLimit === 5 && res.body.days.mon === null, "no weekday limits yet, all use the normal limit");
  check(res.body.today.day === today && res.body.today.limit === 5, "today's limit is the normal one");

  res = await put("/children/10/day-limits", parent1, { days: { [today]: 600, [yesterday]: 800 } });
  check(res.status === 200 && res.body.days[today] === 6 && res.body.today.limit === 6, "parent sets a different limit for today's weekday");

  res = await put("/children/10/day-limits", parent1, { days: { funday: 500 } });
  check(res.status === 400, "unknown day is rejected");

  res = await put("/children/10/day-limits", parent1, { days: { mon: 99999 } });
  check(res.status === 400, "limit over S$50 is rejected");

  res = await put("/children/10/day-limits", parent1, { days: { mon: 2.5 } });
  check(res.status === 400, "limit must be whole cents");

  res = await put("/children/10/day-limits", parent1, {});
  check(res.status === 400, "missing days is rejected");

  res = await get("/children/10/day-limits", parent2);
  check(res.status === 404, "other parent can't see the limits");

  res = await put("/children/10/day-limits", kidToken, { days: {} });
  check(res.status === 403, "kid can't change limits");

  let money = await getMoneyToday(10);
  check(money.dailyLimit === 6 && money.spentToday === 4.2 && money.leftToday === 1.8 && money.walletBalance === 3,
    "getMoneyToday uses today's weekday limit");

  // spending report
  res = await get("/children/10/spending?period=week", parent1);
  check(res.status === 200 && res.body.days.length === 7 && res.body.to === daysAgo(0) && res.body.from === daysAgo(6), "weekly report has the last 7 days");
  check(res.body.total === 13.7, "weekly total adds up");
  const y = res.body.days[5];
  check(y.limit === 8 && y.spent === 7 && y.overLimit === false, "each day uses that weekday's limit");
  check(res.body.days[6].limit === 6 && res.body.days[6].spent === 4.2, "today is in the report");
  check(res.body.days[3].limit === 5 && res.body.days[3].overLimit === false, "other days use the normal limit");

  res = await get("/children/10/spending?period=month", parent1);
  check(res.status === 200 && res.body.days.length === 30 && res.body.total === 13.7, "monthly report has 30 days");

  res = await get("/children/10/spending", parent1);
  check(res.body.period === "week", "week is the default");

  res = await get("/children/10/spending?period=year", parent1);
  check(res.status === 400, "unknown period is rejected");

  res = await get("/children/12/spending", parent1);
  check(res.status === 404, "parent can't see another parent's kid");

  await put("/children/10/day-limits", parent1, { days: {} }); // back to S$5 every day
  res = await get("/children/10/spending", parent1);
  check(res.body.days[5].overLimit === true && res.body.daysOverLimit === 1, "spending more than the limit is flagged");

  // limit history: limit was S$4 until 2 days ago, then S$8 on yesterday's weekday
  const at = (n) => new Date(Date.now() - n * 86400000);
  limitHistory = [
    { child_id: 10, changed_at: at(20), daily_limit: "4.00", day_limits: {} },
    { child_id: 10, changed_at: at(2), daily_limit: "5.00", day_limits: { [(todayIdx + 6) % 7]: 8 } },
  ];
  res = await get("/children/10/spending?period=month", parent1);
  const m = res.body.days;
  check(m[19].limit === 4, "a day 10 days ago uses the limit it had back then");
  check(m[28].limit === 8 && m[28].overLimit === false, "yesterday uses yesterday's weekday limit from the history");
  check(m[0].limit === 4, "days before the history started use the oldest saved limit");
  limitHistory = [];

  // alerts
  res = await get("/children/alerts", parent1);
  check(res.status === 200, "parent gets alerts");
  check(typesFor(res.body.alerts, 10) === "low_wallet,near_limit", "Ethan: wallet under one day's money + 84% of limit used");
  check(typesFor(res.body.alerts, 11) === "limit_reached,pin_locked", "Chloe: limit used up + PIN locked");
  check(!res.body.alerts.some((a) => a.childId === 12), "no alerts for other parents' kids");
  check(res.body.alerts.every((a) => a.message && a.name), "alerts have a name and message");

  await put("/children/10/day-limits", parent1, { days: { [today]: 1000 } });
  res = await get("/children/alerts", parent1);
  check(typesFor(res.body.alerts, 10) === "low_wallet", "near limit goes away when today's limit is higher");

  res = await get("/children/alerts", kidToken);
  check(res.status === 403, "kids can't get parent alerts");

  // parent picks the low wallet amount
  res = await get("/children/11/wallet-alert", parent1);
  check(res.status === 200 && res.body.alertBelow === null, "no alert amount picked yet");
  res = await put("/children/11/wallet-alert", parent1, { alertBelowCents: 2500 });
  check(res.status === 200 && res.body.alertBelow === 25, "parent picks S$25");
  res = await get("/children/alerts", parent1);
  const chloeLow = res.body.alerts.find((a) => a.childId === 11 && a.type === "low_wallet");
  check(chloeLow && chloeLow.picked && chloeLow.alertBelow === 25, "Chloe's S$20 wallet is now low (under S$25)");

  await put("/children/10/wallet-alert", parent1, { alertBelowCents: 200 });
  res = await get("/children/alerts", parent1);
  check(!typesFor(res.body.alerts, 10).includes("low_wallet"), "Ethan's S$3 is fine with a S$2 alert");

  res = await put("/children/10/wallet-alert", parent1, { alertBelowCents: null });
  res = await get("/children/alerts", parent1);
  check(typesFor(res.body.alerts, 10).includes("low_wallet"), "null goes back to one day's limit");

  res = await put("/children/10/wallet-alert", parent1, { alertBelowCents: 50 });
  check(res.status === 400, "under S$1 is rejected");
  res = await put("/children/10/wallet-alert", parent1, { alertBelowCents: "500" });
  check(res.status === 400, "has to be a number of cents");
  res = await put("/children/12/wallet-alert", parent1, { alertBelowCents: 500 });
  check(res.status === 404, "can't set it for another parent's kid");

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exitCode = failed ? 1 : 0;
}

run();
