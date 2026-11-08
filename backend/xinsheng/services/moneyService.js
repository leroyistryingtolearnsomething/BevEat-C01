// Daily limit helpers: which limit applies on which day, and money left today (api-contracts 2c)
const Home = require("../../gabriel/models/homeModel"); // reuse Gabriel's queries, not edited
const DayLimit = require("../models/dayLimitModel");

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Singapore is UTC+8 all year
const sgWeekdayToday = () => new Date(Date.now() + 8 * 3600 * 1000).getUTCDay();
const weekdayOf = (isoDate) => new Date(isoDate + "T00:00:00Z").getUTCDay();

// rows from DayLimit.getDayLimits -> limit for that weekday, or the normal daily limit
function limitFor(defaultLimit, dayRows, weekday) {
  const row = dayRows.find((r) => Number(r.weekday) === weekday);
  return row ? Number(row.daily_limit) : Number(defaultLimit);
}

// history rows (oldest first) -> limit that was set at the end of that Singapore day
// days before the first saved change use the oldest one, null if there's no history at all
function limitOnDay(history, isoDate) {
  if (history.length === 0) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const endOfDay = Date.UTC(y, m - 1, d + 1) - 8 * 3600 * 1000;
  let row = history[0];
  for (const h of history) if (new Date(h.changed_at).getTime() < endOfDay) row = h;
  const dayLimits = row.day_limits || {};
  const weekday = weekdayOf(isoDate);
  return Number(dayLimits[weekday] ?? row.daily_limit);
}

const round2 = (n) => Math.round(n * 100) / 100;

// null if the kid has no profile
async function getMoneyToday(childId) {
  const child = await Home.getChildSummary(childId);
  if (!child) return null;
  const dayRows = await DayLimit.getDayLimits(childId);
  const dailyLimit = limitFor(child.daily_limit, dayRows, sgWeekdayToday());
  const spentToday = Number(await Home.getSpentToday(childId));
  return {
    dailyLimit,
    spentToday,
    leftToday: round2(Math.max(dailyLimit - spentToday, 0)),
    walletBalance: Number(child.wallet_balance),
  };
}

module.exports = { DAYS, sgWeekdayToday, weekdayOf, limitFor, limitOnDay, round2, getMoneyToday };
