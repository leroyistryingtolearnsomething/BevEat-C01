// Parent spending report + low money alerts
const Home = require("../../gabriel/models/homeModel");
const ChildAccount = require("../../leroy/models/childAccountModel"); // Leroy's kid list (wallet, limit, spent today)
const DayLimit = require("../models/dayLimitModel");
const Spending = require("../models/spendingModel");
const User = require("../models/userModel");
const WalletAlert = require("../models/walletAlertModel");
const { DAYS, sgWeekdayToday, weekdayOf, limitFor, limitOnDay, round2 } = require("../services/moneyService");

const PERIOD_DAYS = { week: 7, month: 30 };
const NEAR_LIMIT = 0.8; // warn at 80% of the day's limit

const money = (n) => `S$${n.toFixed(2)}`;

// GET /api/children/:childId/spending?period=week|month  (req.childId from requireOwnChild)
async function getSpendingReport(req, res, next) {
  const period = req.query.period || "week";
  if (!PERIOD_DAYS[period]) return res.status(400).json({ error: "period must be week or month" });
  try {
    const child = await Home.getChildSummary(req.childId);
    const dayRows = await DayLimit.getDayLimits(req.childId);
    const rows = await Spending.getDailySpend(req.childId, PERIOD_DAYS[period]);
    const history = await Spending.getLimitHistory(req.childId);

    // limit the kid had on that day (from the history), current limit if there's no history
    const days = rows.map((r) => {
      const weekday = weekdayOf(r.day);
      const limit = limitOnDay(history, r.day) ?? limitFor(child.daily_limit, dayRows, weekday);
      const spent = Number(r.spent);
      return { date: r.day, day: DAYS[weekday], spent, limit, overLimit: spent > limit };
    });
    const total = round2(days.reduce((sum, d) => sum + d.spent, 0));
    const totalLimit = round2(days.reduce((sum, d) => sum + d.limit, 0));

    res.json({
      childId: req.childId,
      name: child.display_name,
      period,
      from: days[0].date,
      to: days[days.length - 1].date,
      total,
      totalLimit,
      averagePerDay: round2(total / days.length),
      daysOverLimit: days.filter((d) => d.overLimit).length,
      days,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/children/alerts  (parent app checks this like the kid's ready ping)
async function getAlerts(req, res, next) {
  try {
    const kids = await ChildAccount.listForParent(req.user.id);
    if (kids.length === 0) return res.json({ alerts: [] });
    const ids = kids.map((k) => k.child_id);
    const dayRows = await DayLimit.getDayLimitsForChildren(ids);
    const locked = await User.getLockedChildIds(ids);
    const walletAlerts = await WalletAlert.getForChildren(ids);
    const today = sgWeekdayToday();

    const alerts = [];
    for (const k of kids) {
      const name = k.display_name;
      const limit = limitFor(k.daily_limit, dayRows.filter((r) => r.child_id === k.child_id), today);
      const spent = Number(k.spent_today);
      const wallet = Number(k.wallet_balance);
      const add = (type, message, extra) => alerts.push({ childId: k.child_id, name, type, message, ...extra });
      // amount the parent picked, otherwise one day's limit
      const picked = walletAlerts.find((w) => w.child_id === k.child_id);
      const alertBelow = picked ? Number(picked.alert_below) : limit;

      if (locked.includes(k.child_id))
        add("pin_locked", `${name} typed the wrong PIN 5 times. Reset the PIN to unlock it.`);
      if (wallet < alertBelow)
        add(
          "low_wallet",
          picked
            ? `${name}'s wallet has ${money(wallet)}, under the ${money(alertBelow)} you picked.`
            : `${name}'s wallet has ${money(wallet)}, less than one day's food money (${money(limit)}).`,
          { alertBelow, picked: !!picked }
        );
      if (limit > 0 && spent >= limit)
        add("limit_reached", `${name} has used all of today's ${money(limit)}.`);
      else if (limit > 0 && spent >= limit * NEAR_LIMIT)
        add("near_limit", `${name} has used ${money(spent)} of today's ${money(limit)}.`);
    }
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
}

// GET /api/children/:childId/wallet-alert  -> { alertBelow } (null = one day's limit)
async function getWalletAlert(req, res, next) {
  try {
    const [row] = await WalletAlert.getForChildren([req.childId]);
    res.json({ alertBelow: row ? Number(row.alert_below) : null });
  } catch (err) {
    next(err);
  }
}

// PUT /api/children/:childId/wallet-alert  body { alertBelowCents }  (null = back to one day's limit)
async function setWalletAlert(req, res, next) {
  const { alertBelowCents } = req.body || {};
  const ok = alertBelowCents === null || (Number.isInteger(alertBelowCents) && alertBelowCents >= 100 && alertBelowCents <= 10000);
  if (!ok) return res.status(400).json({ error: "Alert amount must be S$1 to S$100" });
  try {
    const amount = alertBelowCents === null ? null : alertBelowCents / 100;
    await WalletAlert.setAlert(req.childId, amount);
    res.json({ alertBelow: amount });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSpendingReport, getAlerts, getWalletAlert, setWalletAlert };
