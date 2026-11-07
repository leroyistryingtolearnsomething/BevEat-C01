// Parent adds / removes allergies that aren't in the preset list (e.g. kiwi, mango, coconut)
const CustomAllergy = require("../models/customAllergyModel");

const MAX_PER_CHILD = 10;
const LABEL_RE = /^[A-Za-z][A-Za-z' -]{1,39}$/; // same rule as the database CHECK

// "  kiwi   FRUIT " -> "Kiwi fruit"
function tidyLabel(raw) {
  if (typeof raw !== "string") return "";
  const words = raw.trim().replace(/\s+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

// "Wheat / gluten" -> ["wheat / gluten", "wheat", "gluten"], "Peanuts" -> [..., "peanut"]
function presetWords(name) {
  const lower = name.toLowerCase();
  const parts = lower.split("/").map((p) => p.trim());
  return [lower, ...parts, ...parts.map((p) => p.replace(/s$/, ""))];
}

const toJson = (row) => ({
  id: row.custom_allergy_id,
  label: row.label,
  icon: row.icon,
  ...(row.blocked_dishes && { blockedDishes: row.blocked_dishes }),
});

// GET /api/children/:childId/custom-allergies
async function list(req, res, next) {
  try {
    const rows = await CustomAllergy.listForChild(req.childId);
    res.json({ customAllergies: rows.map(toJson) });
  } catch (err) {
    next(err);
  }
}

// POST /api/children/:childId/custom-allergies  body { label }
async function add(req, res, next) {
  const label = tidyLabel((req.body || {}).label);
  if (!LABEL_RE.test(label))
    return res.status(400).json({ error: "Type 2 to 40 letters, e.g. Kiwi or Coconut milk" });

  try {
    const preset = (await CustomAllergy.presetNames()).find((name) => presetWords(name).includes(label.toLowerCase()));
    if (preset) return res.status(400).json({ error: `${preset} is already in the list above. Tap it there instead.` });
    if ((await CustomAllergy.countForChild(req.childId)) >= MAX_PER_CHILD)
      return res.status(400).json({ error: `You can add up to ${MAX_PER_CHILD} of your own allergies` });

    await CustomAllergy.add(req.childId, label);
    // send back the full list, so the new row comes with the dishes it blocks
    const rows = await CustomAllergy.listForChild(req.childId);
    res.status(201).json({ customAllergies: rows.map(toJson) });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: `${label} is already added` });
    next(err);
  }
}

// DELETE /api/children/:childId/custom-allergies/:customAllergyId
async function remove(req, res, next) {
  const id = Number(req.params.customAllergyId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid allergy id" });
  try {
    if (!(await CustomAllergy.remove(req.childId, id))) return res.status(404).json({ error: "Allergy not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, add, remove, tidyLabel };
