// Parent macros screens (CB69-50): a kid's food for one day, one week, and the order list.
// req.childId comes from requireOwnChild, so a parent only ever sees their own kids.
const Macros = require("../models/macrosModel");
const N = require("../services/nutrition");

const RANGES = ["this_week", "last_week", "this_month"];

// header info shared by all three screens
async function childAndGuide(childId) {
  const child = await Macros.getChild(childId);
  const age = child.birth_year ? N.sgYear() - child.birth_year : null;
  const guide = await Macros.getGuide(age);
  return {
    child: { id: child.child_id, name: child.display_name, age },
    guide,
    guideOut: guide && {
      ageFrom: guide.age_from,
      ageTo: guide.age_to,
      kcal: guide.kcal,
      targets: Object.fromEntries(N.NUTRIENTS.map(({ key }) => [key, Number(guide[`${key}_g`])])),
    },
  };
}

// one order as the screens show it
function orderOut(o) {
  const t = N.roundTotals(N.orderTotals(o));
  return {
    id: o.order_id,
    name: o.items.map((it) => (it.qty > 1 ? `${it.qty}× ${it.name}` : it.name)).join(" + "),
    stall: o.stall_name,
    placedAt: o.placed_at,
    day: o.day,
    price: Number(o.total_amount),
    ...t,
    allergyClashes: o.clashes, // the kid's allergens in this order (empty = safe)
    allergensChecked: o.items.every((it) => it.checked), // a person has checked every dish's allergen list
    // what was on the stall's ticket, e.g. "Mum asks: Less salt" (Ask Mum changes, CB69-74)
    ticketNotes: o.items.map((it) => it.comment).filter(Boolean),
  };
}

// GET /api/children/:childId/macros/day?date=YYYY-MM-DD   (default: today in Singapore)
async function getDay(req, res, next) {
  const date = req.query.date ?? N.sgToday();
  if (!N.isDate(date)) return res.status(400).json({ error: "date must look like 2026-11-06" });
  try {
    const { child, guide, guideOut } = await childAndGuide(req.childId);
    const orders = (await Macros.getOrders(req.childId, date, date)).map(orderOut);
    const totals = N.roundTotals(N.sumTotals(orders));
    const share = N.energyShare(totals.kcal, guide);
    res.json({
      child,
      date,
      isToday: date === N.sgToday(),
      guide: guideOut,
      totals,
      meals: orders.length,
      energyPct: guide ? Math.round(share * 100) : null,
      nutrients: N.nutrientRows(totals, guide, share),
      orders,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/children/:childId/macros/week?start=YYYY-MM-DD   (any day in the week; default: this week)
// Averages are per day the kid ate (so a day off school doesn't drag the average down).
async function getWeek(req, res, next) {
  const any = req.query.start ?? N.sgToday();
  if (!N.isDate(any)) return res.status(400).json({ error: "start must look like 2026-11-02" });
  const start = N.mondayOf(any);
  const end = N.addDays(start, 6);
  const lastStart = N.addDays(start, -7);
  try {
    const { child, guide, guideOut } = await childAndGuide(req.childId);
    const all = (await Macros.getOrders(req.childId, lastStart, end)).map(orderOut);
    const thisWeek = all.filter((o) => o.day >= start);
    const lastWeek = all.filter((o) => o.day < start);

    // per day: Mon-Fri always shown, Sat/Sun only if the kid ate then
    const byDay = (list) => {
      const m = new Map();
      for (const o of list) m.set(o.day, [...(m.get(o.day) || []), o]);
      return m;
    };
    const days = byDay(thisWeek);
    const dayRows = [];
    for (let i = 0; i < 7; i++) {
      const date = N.addDays(start, i);
      const list = days.get(date) || [];
      if (N.isWeekend(date) && !list.length) continue;
      const t = N.roundTotals(N.sumTotals(list));
      dayRows.push({ date, kcal: t.kcal, meals: list.length, totals: t });
    }

    const eaten = dayRows.filter((d) => d.meals > 0);
    const avg = (key) => {
      const vals = eaten.map((d) => d.totals[key]).filter((v) => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const avgTotals = Object.fromEntries(["kcal", ...N.NUTRIENTS.map((n) => n.key)].map((k) => [k, avg(k)]));
    const avgKcal = avgTotals.kcal === null ? 0 : Math.round(avgTotals.kcal);
    const share = N.energyShare(avgKcal, guide);

    const lastDays = [...byDay(lastWeek).values()].map((l) => N.sumTotals(l).kcal);
    const lastAvg = lastDays.length ? lastDays.reduce((a, b) => a + b, 0) / lastDays.length : null;

    const nutrients = N.nutrientRows(avgTotals, guide, share).map((row) => {
      const kind = N.NUTRIENTS.find((n) => n.key === row.key).kind;
      const flagged = eaten.filter(
        (d) => row.status && N.statusFor(kind, d.totals[row.key], row.target, N.energyShare(d.kcal, guide)) === row.status
      ).length;
      return { ...row, daysFlagged: flagged, daysCounted: eaten.length };
    });
    // the one thing to suggest: first "low", else first "high"
    const tipRow = nutrients.find((n) => n.status === "low") || nutrients.find((n) => n.status === "high");

    res.json({
      child,
      start,
      end,
      guide: guideOut,
      days: dayRows.map(({ totals, ...d }) => d),
      avgKcal,
      meals: thisWeek.length,
      energyPct: guide ? Math.round(share * 100) : null,
      vsLastWeekPct: lastAvg && eaten.length ? Math.round(((avgKcal - lastAvg) / lastAvg) * 100) : null,
      nutrients,
      tip: tipRow ? { nutrient: tipRow.key, status: tipRow.status } : null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/children/:childId/orders?range=this_week|last_week|this_month
async function listOrders(req, res, next) {
  const range = req.query.range ?? "this_week";
  if (!RANGES.includes(range)) return res.status(400).json({ error: `range must be one of ${RANGES.join(", ")}` });
  const today = N.sgToday();
  const monday = N.mondayOf(today);
  const [from, to] =
    range === "this_week" ? [monday, N.addDays(monday, 6)]
    : range === "last_week" ? [N.addDays(monday, -7), N.addDays(monday, -1)]
    : [`${today.slice(0, 8)}01`, today];
  try {
    const { child } = await childAndGuide(req.childId);
    const orders = (await Macros.getOrders(req.childId, from, to)).map(orderOut);
    const days = [];
    for (const o of orders) {
      let d = days.at(-1);
      if (!d || d.date !== o.day) days.push((d = { date: o.day, kcal: 0, total: 0, orders: [] }));
      d.orders.push(o);
      d.kcal += o.kcal;
      d.total = Number((d.total + o.price).toFixed(2));
    }
    res.json({ child, range, from, to, today, days });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDay, getWeek, listOrders };
