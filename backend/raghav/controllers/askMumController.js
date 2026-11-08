// Ask Mum (Kids Figma 05b): the child asks Mum to allow a dish that one of Mum's rules blocks.
// Leroy's parent app approves or denies it (docs/api-contracts.md §2f).
const Menu = require("../models/menuModel");
const AskMum = require("../models/askMumModel");
const { STATUS, decideDish } = require("../services/dishSafety");
const { loadChildContext, toDishFacts } = require("../services/menuService");
const { toId, isId } = require("./validation");

const UNIQUE_VIOLATION = "23505"; // Postgres error code for a broken unique index

function toRequestJson(row) {
  return {
    requestId: row.request_id,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

// POST /api/ask-mum  body { itemId }
async function askMum(req, res, next) {
  const { itemId } = req.body || {};
  if (!isId(itemId)) return res.status(400).json({ error: "Invalid dish id" });
  const childId = req.user.id;

  try {
    const row = await Menu.getAvailableDish(itemId);
    if (!row) return res.status(404).json({ error: "Dish not found" });

    // One request per child, per dish, per day, whatever Mum answered: send back the one
    // already made instead of pinging Mum again
    const existing = await AskMum.findToday(childId, itemId);
    if (existing) return res.json(toRequestJson(existing));

    const child = await loadChildContext(childId);
    if (!child) return res.status(404).json({ error: "Child not found" });

    const verdict = decideDish(toDishFacts(row), child);
    // Mum can't say yes to an allergy: dishSafety would ignore the approval anyway, so we
    // don't even send her the request
    if (verdict.status === STATUS.BLOCKED_ALLERGY)
      return res.status(409).json({ error: "Ask Mum can't unlock allergies" });
    if (verdict.status === STATUS.ALLOWED) return res.status(409).json({ error: "This dish isn't locked" });

    try {
      const created = await AskMum.create(childId, itemId);
      res.status(201).json(toRequestJson(created));
    } catch (err) {
      // Two taps at the same moment: the unique index stops the second one, so hand back the first
      if (err.code !== UNIQUE_VIOLATION) throw err;
      res.json(toRequestJson(await AskMum.findToday(childId, itemId)));
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/ask-mum/:itemId  (05b shows "Sent" again if the child comes back)
async function getAskMum(req, res, next) {
  const itemId = toId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "Invalid dish id" });
  try {
    const row = await AskMum.findToday(req.user.id, itemId); // only ever this child's own request
    res.json({ request: row ? toRequestJson(row) : null });
  } catch (err) {
    next(err);
  }
}

module.exports = { askMum, getAskMum };
