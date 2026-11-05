// Parent adds a kid: login name + 4-digit PIN, daily food money, allergies
const bcrypt = require("bcrypt");
const ChildAccount = require("../models/childAccountModel");

const SALT_ROUNDS = 10;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
const PIN_RE = /^\d{4}$/;
// keys the app sends -> names in the allergens table
const ALLERGENS = {
  peanut: "Peanuts", "tree nuts": "Tree nuts", milk: "Milk", egg: "Egg", shellfish: "Shellfish",
  fish: "Fish", soy: "Soy", wheat: "Wheat / gluten", sesame: "Sesame",
};

// POST /api/children  body { displayName, username, pin, dailyLimitCents, allergens: ["peanut", ...] }
async function addChild(req, res, next) {
  const { displayName, username, pin, dailyLimitCents, allergens = [] } = req.body || {};
  const name = typeof displayName === "string" ? displayName.trim() : "";
  if (!name || name.length > 50) return res.status(400).json({ error: "Enter your child's name" });
  if (typeof username !== "string" || !USERNAME_RE.test(username))
    return res.status(400).json({ error: "Login name must be 3 to 20 letters, numbers or _" });
  if (typeof pin !== "string" || !PIN_RE.test(pin)) return res.status(400).json({ error: "PIN must be 4 numbers" });
  if (!Number.isInteger(dailyLimitCents) || dailyLimitCents < 100 || dailyLimitCents > 5000)
    return res.status(400).json({ error: "Daily food money must be S$1 to S$50" });
  if (!Array.isArray(allergens) || allergens.some((a) => !Object.hasOwn(ALLERGENS, a)))
    return res.status(400).json({ error: "Unknown allergy" });

  try {
    const childId = await ChildAccount.createChild(req.user.id, {
      name,
      username: username.toLowerCase(), // kid log in ignores case, so store one spelling
      pinHash: await bcrypt.hash(pin, SALT_ROUNDS),
      dailyLimit: dailyLimitCents / 100,
      allergenNames: [...new Set(allergens)].map((a) => ALLERGENS[a]),
    });
    res.status(201).json({ child: { id: childId, name, username: username.toLowerCase() } });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That login name is taken" });
    next(err);
  }
}

module.exports = { addChild };
