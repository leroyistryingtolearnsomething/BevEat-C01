// Parent's kids: list them, add one, change allergies and daily food money
const bcrypt = require("bcrypt");
const ChildAccount = require("../models/childAccountModel");
const DayLimit = require("../../xinsheng/models/dayLimitModel"); // weekday limits (Xin Sheng)
const { limitFor, sgWeekdayToday } = require("../../xinsheng/services/moneyService");

const SALT_ROUNDS = 10;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
const PIN_RE = /^\d{4}$/;
// keys the app sends -> names in the allergens table
const ALLERGENS = {
  peanut: "Peanuts", "tree nuts": "Tree nuts", milk: "Milk", egg: "Egg", shellfish: "Shellfish",
  fish: "Fish", soy: "Soy", wheat: "Wheat / gluten", sesame: "Sesame",
};
const KEY_FOR = Object.fromEntries(Object.entries(ALLERGENS).map(([key, name]) => [name, key]));

const validAllergens = (list) => Array.isArray(list) && list.every((a) => Object.hasOwn(ALLERGENS, a));
const validLimitCents = (c) => Number.isInteger(c) && c >= 100 && c <= 5000;
const allergenNames = (keys) => [...new Set(keys)].map((a) => ALLERGENS[a]);

// GET /api/children
async function listChildren(req, res, next) {
  try {
    const rows = await ChildAccount.listForParent(req.user.id);
    const dayRows = rows.length ? await DayLimit.getDayLimitsForChildren(rows.map((c) => c.child_id)) : [];
    const today = sgWeekdayToday();
    res.json({
      children: rows.map((c) => ({
        id: c.child_id,
        name: c.display_name,
        avatarEmoji: c.avatar_emoji,
        walletBalance: Number(c.wallet_balance),
        dailyLimit: Number(c.daily_limit),
        // today's limit, different from dailyLimit when a weekday limit is set for today
        todayLimit: limitFor(c.daily_limit, dayRows.filter((r) => r.child_id === c.child_id), today),
        spentToday: Number(c.spent_today),
        allergens: c.allergens.map((name) => KEY_FOR[name]).filter(Boolean),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/children  body { displayName, username, pin, dailyLimitCents, allergens: ["peanut", ...] }
async function addChild(req, res, next) {
  const { displayName, username, pin, dailyLimitCents, allergens = [] } = req.body || {};
  const name = typeof displayName === "string" ? displayName.trim() : "";
  if (!name || name.length > 50) return res.status(400).json({ error: "Enter your child's name" });
  if (typeof username !== "string" || !USERNAME_RE.test(username))
    return res.status(400).json({ error: "Login name must be 3 to 20 letters, numbers or _" });
  if (typeof pin !== "string" || !PIN_RE.test(pin)) return res.status(400).json({ error: "PIN must be 4 numbers" });
  if (!validLimitCents(dailyLimitCents)) return res.status(400).json({ error: "Daily food money must be S$1 to S$50" });
  if (!validAllergens(allergens)) return res.status(400).json({ error: "Unknown allergy" });

  try {
    const childId = await ChildAccount.createChild(req.user.id, {
      name,
      username: username.toLowerCase(), // kid log in ignores case, so store one spelling
      pinHash: await bcrypt.hash(pin, SALT_ROUNDS),
      dailyLimit: dailyLimitCents / 100,
      allergenNames: allergenNames(allergens),
    });
    res.status(201).json({ child: { id: childId, name, username: username.toLowerCase() } });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That login name is taken" });
    next(err);
  }
}

// PUT /api/children/:childId/allergies  body { allergens: ["peanut", ...] }  (req.childId from requireOwnChild)
async function setAllergies(req, res, next) {
  const { allergens } = req.body || {};
  if (!validAllergens(allergens)) return res.status(400).json({ error: "Unknown allergy" });
  try {
    await ChildAccount.setAllergies(req.childId, allergenNames(allergens));
    res.json({ allergens: [...new Set(allergens)] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/children/:childId/daily-limit  body { dailyLimitCents }
async function setDailyLimit(req, res, next) {
  const { dailyLimitCents } = req.body || {};
  if (!validLimitCents(dailyLimitCents)) return res.status(400).json({ error: "Daily food money must be S$1 to S$50" });
  try {
    await ChildAccount.setDailyLimit(req.childId, dailyLimitCents / 100);
    res.json({ dailyLimit: dailyLimitCents / 100 });
  } catch (err) {
    next(err);
  }
}

module.exports = { listChildren, addChild, setAllergies, setDailyLimit };
