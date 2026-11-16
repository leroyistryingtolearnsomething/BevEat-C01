// Per weekday limits, e.g. $3 on Monday but $6 on Friday (req.childId from requireOwnChild)
const Home = require("../../gabriel/models/homeModel");
const DayLimit = require("../models/dayLimitModel");
const { DAYS, sgWeekdayToday, limitFor } = require("../services/moneyService");

// same range as the normal daily limit ($1 to $50)
const validLimitCents = (c) => Number.isInteger(c) && c >= 100 && c <= 5000;

async function dayLimitsJson(childId) {
  const child = await Home.getChildSummary(childId);
  const rows = await DayLimit.getDayLimits(childId);
  const days = {};
  DAYS.forEach((d, i) => {
    const row = rows.find((r) => Number(r.weekday) === i);
    days[d] = row ? Number(row.daily_limit) : null; // null = normal daily limit
  });
  const today = sgWeekdayToday();
  return {
    defaultLimit: Number(child.daily_limit),
    days,
    today: { day: DAYS[today], limit: limitFor(child.daily_limit, rows, today) },
  };
}

// GET /api/children/:childId/day-limits
async function getDayLimits(req, res, next) {
  try {
    res.json(await dayLimitsJson(req.childId));
  } catch (err) {
    next(err);
  }
}

// PUT /api/children/:childId/day-limits  body { days: { mon: 300, fri: 600 } }  (cents, days left out or null = normal limit)
async function setDayLimits(req, res, next) {
  const { days } = req.body || {};
  if (!days || typeof days !== "object" || Array.isArray(days))
    return res.status(400).json({ error: "days is required" });

  const list = [];
  for (const [day, cents] of Object.entries(days)) {
    const weekday = DAYS.indexOf(day);
    if (weekday === -1) return res.status(400).json({ error: `Unknown day ${day}` });
    if (cents === null) continue;
    if (!validLimitCents(cents)) return res.status(400).json({ error: "Daily food money must be $1 to $50" });
    list.push({ weekday, dailyLimit: cents / 100 });
  }

  try {
    await DayLimit.setDayLimits(req.childId, list);
    res.json(await dayLimitsJson(req.childId));
  } catch (err) {
    next(err);
  }
}

module.exports = { getDayLimits, setDayLimits };
