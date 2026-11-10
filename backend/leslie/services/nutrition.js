// Nutrition maths for the parent macros screens (CB69-50). No database here, so it is easy to test.
// All numbers come from the DB (order_items + nutrient_guides); this file only adds them up and compares.

// The five bars on the screen, in screen order.
// kind: "aim"   = more is good up to the guide (protein, fibre): can be "on_target" or "low"
//       "limit" = keep under the guide (fat, sugar): can be "high"
//       "range" = carbs: only flagged when over the guide
const NUTRIENTS = [
  { key: "carbs", label: "Carbs", kind: "range" },
  { key: "protein", label: "Protein", kind: "aim" },
  { key: "fat", label: "Fat", kind: "limit" },
  { key: "fibre", label: "Fibre", kind: "aim" },
  { key: "sugar", label: "Sugar", kind: "limit" },
];
// "low" = under 60% of what you'd expect for the food eaten so far
const LOW_RATIO = 0.6;

const TZ = "Asia/Singapore";
const DAY_MS = 86400000;

// ---------- dates (all as "YYYY-MM-DD" in Singapore time) ----------

const sgToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: TZ });
const sgYear = (now = new Date()) => Number(sgToday(now).slice(0, 4));
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
// Monday of the week the date is in
function mondayOf(date) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}
const isWeekend = (date) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

// ---------- adding up ----------

const num = (v) => (v === null || v === undefined ? null : Number(v));

// one order row from the model -> totals for that order. fibre/sugar stay null if no dish has a value yet
function orderTotals(order) {
  const t = { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: null, sugar: null };
  for (const it of order.items) {
    const q = Number(it.qty) || 1;
    t.kcal += q * (num(it.kcal) || 0);
    for (const k of ["carbs", "protein", "fat"]) t[k] += q * (num(it[k]) || 0);
    for (const k of ["fibre", "sugar"]) if (num(it[k]) !== null) t[k] = (t[k] || 0) + q * num(it[k]);
  }
  return t;
}

function sumTotals(list) {
  const t = { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: null, sugar: null };
  for (const x of list) {
    for (const k of ["kcal", "carbs", "protein", "fat"]) t[k] += x[k];
    for (const k of ["fibre", "sugar"]) if (x[k] !== null) t[k] = (t[k] || 0) + x[k];
  }
  return t;
}

const round = (v, dp = 0) => (v === null ? null : Number(v.toFixed(dp)));
const roundTotals = (t) => ({
  kcal: Math.round(t.kcal),
  carbs: round(t.carbs), protein: round(t.protein), fat: round(t.fat), fibre: round(t.fibre), sugar: round(t.sugar),
});

// ---------- comparing with the guide ----------

// share = how much of the day's energy has been eaten (0..1). An "aim" nutrient is judged against that share,
// so 2 meals of 3 aren't called "low" just because dinner hasn't happened yet.
function statusFor(kind, actual, target, share) {
  if (actual === null || !target) return null;
  if (kind === "aim") {
    const expected = target * Math.min(1, share);
    if (actual >= expected) return "on_target";
    if (actual < expected * LOW_RATIO) return "low";
    return null;
  }
  return actual > target ? "high" : null;
}

function nutrientRows(totals, guide, share) {
  return NUTRIENTS.map(({ key, label, kind }) => {
    const target = guide ? Number(guide[`${key}_g`]) : null;
    return { key, label, actual: round(totals[key]), target, status: guide ? statusFor(kind, totals[key], target, share) : null };
  });
}

const energyShare = (kcal, guide) => (guide ? kcal / Number(guide.kcal) : 0);

module.exports = {
  NUTRIENTS, sgToday, sgYear, isDate, addDays, mondayOf, isWeekend,
  orderTotals, sumTotals, roundTotals, statusFor, nutrientRows, energyShare,
};
