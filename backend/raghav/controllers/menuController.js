// Stall menu (Kids Figma 03) and food detail (04, or 05 / 05b when the dish is locked)
const Stall = require("../models/stallModel");
const Menu = require("../models/menuModel");
const { toStallJson } = require("./stallController");
const { decideAddOn, safeChecks } = require("../services/dishSafety");
const { loadChildContext, toDishFacts, buildDishCards, isAllowed } = require("../services/menuService");
const { toId } = require("./validation");

const VIEWS = ["safe", "all"];
const MAX_ALTERNATIVES = 2; // the Figma shows two "Try these yummy picks instead" cards

// ?view= is optional and defaults to "safe". Anything else, including ?view=a&view=b
// (which Express turns into an array), is rejected.
function parseView(view) {
  if (view === undefined) return "safe";
  return VIEWS.includes(view) ? view : null;
}

// GET /api/stalls/:stallId/menu?view=safe|all
async function getStallMenu(req, res, next) {
  const stallId = toId(req.params.stallId);
  if (!stallId) return res.status(400).json({ error: "Invalid stall id" });
  const view = parseView(req.query.view);
  if (!view) return res.status(400).json({ error: "view must be safe or all" });

  try {
    const stall = await Stall.getStallById(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found" });
    const child = await loadChildContext(req.user.id);
    if (!child) return res.status(404).json({ error: "Child not found" });

    const cards = (await buildDishCards(await Menu.getAvailableDishesForStall(stallId), child)).map((c) => c.card);
    const safe = cards.filter(isAllowed);
    // filter() keeps the original order, so each group stays in menu order
    const locked = cards.filter((c) => !isAllowed(c));

    res.json({
      stall: toStallJson(stall),
      money: { canSpend: child.canSpend },
      counts: { safe: safe.length, total: cards.length },
      // "safe" (the default) leaves locked dishes out of the response completely.
      // "all" includes them, but only as locked cards (food detail sends no add-ons for them,
      // and the tray rejects them), AFTER every dish the child can have, so what they can
      // order comes first.
      dishes: view === "safe" ? safe : [...safe, ...locked],
    });
  } catch (err) {
    next(err);
  }
}

// DB add-on row + verdict -> one row in the "Extras" list
function toAddOnJson(row, verdict) {
  return {
    id: row.add_on_id,
    name: row.name,
    extraPrice: Number(row.extra_price),
    allergen: row.allergen_name ? { name: row.allergen_name, icon: row.allergen_icon } : null,
    ...verdict,
  };
}

// Up to 2 dishes from the same stall the child can actually order right now, most-loved first
function pickAlternatives(cards, itemId) {
  return cards
    .filter((c) => c.id !== itemId && isAllowed(c) && !c.overBudget)
    .sort((a, b) => b.hearts - a.hearts || a.price - b.price)
    .slice(0, MAX_ALTERNATIVES);
}

// GET /api/menu-items/:itemId
async function getDishDetail(req, res, next) {
  const itemId = toId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "Invalid dish id" });

  try {
    const row = await Menu.getAvailableDish(itemId);
    if (!row) return res.status(404).json({ error: "Dish not found" });
    const child = await loadChildContext(req.user.id);
    if (!child) return res.status(404).json({ error: "Child not found" });

    // the whole stall is judged once: this dish, plus the candidates for "try these instead"
    const judged = await buildDishCards(await Menu.getAvailableDishesForStall(row.stall_id), child);
    const mine = judged.find((j) => j.card.id === itemId);
    const { card, photo } = mine;
    const allowed = isAllowed(card);

    // A locked dish gets no add-ons, so there is nothing to build an order from
    const addOns = allowed
      ? (await Menu.getAddOns(itemId)).map((a) =>
          toAddOnJson(a, decideAddOn({ allergenName: a.allergen_name }, child)))
      : [];

    res.json({
      dish: {
        ...card,
        stallId: row.stall_id,
        stallName: row.stall_name,
        description: row.description,
        photo,
        safeChecks: allowed ? safeChecks(toDishFacts(row), child) : [],
        healthScore: null, // needs schema request #7
        ingredients: [], // needs schema request #3
        addOns,
      },
      // Food detail needs this as well as overBudget: picking extras can push the total over
      // what's left even when the dish alone fits. (Checkout re-checks it on the server.)
      money: { canSpend: child.canSpend },
      alternatives: pickAlternatives(judged.map((j) => j.card), itemId),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStallMenu, getDishDetail };
