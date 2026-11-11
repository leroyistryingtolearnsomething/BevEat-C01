// Mum's rules switches (CB69-18, Figma 09d): "No fried food" and "No sugary drinks" for one kid.
// Turning one on locks those dishes on the kid's menu straight away (Raghav's dishSafety), and the
// kid can still Ask Mum for a one-off yes. Allergies stay on their own screen and can't be lifted.
const Rules = require("../models/foodRuleSettingsModel");

const toJson = (on) => ({ noFried: on.has("no_fried"), noSugary: on.has("no_sugary") });
const FIELDS = { noFried: "no_fried", noSugary: "no_sugary" };

// GET /api/children/:childId/food-rules -> { noFried, noSugary }
async function get(req, res, next) {
  try {
    res.json(toJson(await Rules.listForChild(req.childId)));
  } catch (err) {
    next(err);
  }
}

// PUT /api/children/:childId/food-rules  body { noFried?: boolean, noSugary?: boolean }
async function update(req, res, next) {
  const body = req.body || {};
  const given = Object.keys(FIELDS).filter((k) => body[k] !== undefined);
  if (given.length === 0) return res.status(400).json({ error: "Send noFried and/or noSugary" });
  if (given.some((k) => typeof body[k] !== "boolean"))
    return res.status(400).json({ error: "noFried and noSugary must be true or false" });

  try {
    for (const k of given) {
      if (body[k]) await Rules.turnOn(req.childId, FIELDS[k]);
      else await Rules.turnOff(req.childId, FIELDS[k]);
    }
    res.json(toJson(await Rules.listForChild(req.childId)));
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update };
