// Parent side of Ask Mum (CB69-26, Figma 09a-09c): the bell, the request card, approve / "not today".
// The kid asks with Raghav's POST /api/ask-mum. A yes lets the kid buy that one dish today only;
// Raghav's dishSafety and priceTray already read today's approvals, and never lift an allergy.
const AskMumParent = require("../models/askMumParentModel");
const Teammates = require("../../raghav/services/teammates");
const { findParentRule } = require("../../raghav/services/dishSafety");

const DECISIONS = ["approved", "denied"];
const STATUSES = ["pending", "approved", "denied"];
const MAX_NOTE = 200;

// Which of Mum's rules the dish breaks, as she'd say it ("No fried food"). Rules are read fresh,
// so if Mum has since turned the rule off the card says so instead of guessing.
async function ruleLabelFor(row, rulesCache) {
  if (!rulesCache.has(row.child_id)) rulesCache.set(row.child_id, await Teammates.getFoodRules(row.child_id));
  const dish = {
    itemId: row.item_id,
    isFried: row.is_fried,
    isLowSugar: row.is_low_sugar,
    sugarG: row.sugar_g === null ? null : Number(row.sugar_g),
  };
  const rule = findParentRule(dish, rulesCache.get(row.child_id));
  if (!rule) return null;
  return rule.type === "blocked_item" ? `You locked ${rule.label}` : rule.label;
}

async function toJson(rows) {
  const rulesCache = new Map();
  return Promise.all(
    rows.map(async (r) => ({
      requestId: r.request_id,
      childId: r.child_id,
      childName: r.child_name,
      itemId: r.item_id,
      dishName: r.dish_name,
      stallName: r.stall_name,
      price: Number(r.price),
      imageUrl: r.default_image_url,
      ruleLabel: await ruleLabelFor(r, rulesCache),
      status: r.status,
      parentNote: r.parent_note,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    }))
  );
}

// GET /api/ask-mum/pending  -> { requests: [...] }  every kid's pending asks today (the bell)
async function listPending(req, res, next) {
  try {
    res.json({ requests: await toJson(await AskMumParent.listPendingForParent(req.user.id)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/children/:childId/ask-mum?status=pending  (docs/api-contracts.md §2f)
async function listForChild(req, res, next) {
  const { status } = req.query;
  if (status !== undefined && !STATUSES.includes(status))
    return res.status(400).json({ error: "status must be pending, approved or denied" });
  try {
    res.json({ requests: await toJson(await AskMumParent.listTodayForChild(req.childId, status)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/ask-mum/requests/:requestId  (09b, and 09c after deciding)
async function getOne(req, res, next) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: "Invalid request id" });
  try {
    const row = await AskMumParent.findForParent(requestId, req.user.id);
    if (!row) return res.status(404).json({ error: "Request not found" });
    res.json({ request: (await toJson([row]))[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/ask-mum/:requestId  body { decision: "approved" | "denied", note? }
async function decide(req, res, next) {
  const requestId = Number(req.params.requestId);
  const { decision, note } = req.body || {};
  if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: "Invalid request id" });
  if (!DECISIONS.includes(decision)) return res.status(400).json({ error: "decision must be approved or denied" });
  if (note !== undefined && note !== null && typeof note !== "string")
    return res.status(400).json({ error: "note must be text" });
  const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;
  if (cleanNote && cleanNote.length > MAX_NOTE)
    return res.status(400).json({ error: `Keep the note under ${MAX_NOTE} characters` });

  try {
    const updated = await AskMumParent.decide(requestId, req.user.id, decision, cleanNote);
    if (updated) {
      return res.json({
        requestId: updated.request_id,
        status: updated.status,
        decidedAt: updated.decided_at,
        parentNote: updated.parent_note,
      });
    }
    // Nothing changed: tell "not yours / doesn't exist" (404, same answer so ids can't be probed)
    // apart from "already answered or from an earlier day" (409)
    const row = await AskMumParent.findForParent(requestId, req.user.id);
    if (!row) return res.status(404).json({ error: "Request not found" });
    if (row.status !== "pending") return res.status(409).json({ error: `You already said ${row.status === "approved" ? "yes" : "no"} to this one` });
    return res.status(409).json({ error: "This request has expired. Requests only last for the day." });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPending, listForChild, getOne, decide };
