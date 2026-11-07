// Tray pricing: turns a tray (dish ids, quantities, add-on ids) into real prices from the
// database, and re-runs every safety and money check for this child.
// Used by POST /api/tray/quote, and exported for Leroy's checkout, so the price the kid is shown
// is worked out by exactly the same code that checkout charges.
//
// Call it with items that already passed parseTrayItems (controllers/validation.js).
const Menu = require("../models/menuModel");
const { loadChildContext, toDishFacts } = require("./menuService");
const { STATUS, decideDish, decideAddOn, toCents } = require("./dishSafety");

// Why a tray line can't be ordered any more. The tray screen shows a different message for each.
const REASON = Object.freeze({
  ALLERGY: "allergy",
  PARENT_RULE: "parent_rule",
  SOLD_OUT: "sold_out",
  STALL_CLOSED: "stall_closed",
});

// kind: "invalid" (the request is wrong: 400), "locked" (the food can't be ordered now: 409),
// "no_child" (no child profile: 404). The service doesn't know about HTTP, so each caller
// (my quote controller, Leroy's checkout) turns the kind into its own status code.
class TrayError extends Error {
  constructor(kind, message, problems = []) {
    super(message);
    this.kind = kind;
    this.problems = problems;
  }
}

// All maths is in whole cents; this turns cents back into dollars for the JSON
const fromCents = (cents) => Math.round(cents) / 100;

const macrosOf = (row) => ({
  calories: Number(row.calories) || 0,
  proteinG: Number(row.protein_g) || 0,
  carbsG: Number(row.carbs_g) || 0,
  fatG: Number(row.fat_g) || 0,
});

const addMacros = (a, b) => ({
  calories: a.calories + b.calories,
  proteinG: a.proteinG + b.proteinG,
  carbsG: a.carbsG + b.carbsG,
  fatG: a.fatG + b.fatG,
});

// Every dish must exist and every add-on must belong to the dish it was picked for. If not, the
// request itself is wrong (an old app, or someone editing the request), so it's a 400.
function checkTrayShape(items, dishes, addOns) {
  for (const item of items) {
    if (!dishes.has(item.itemId)) throw new TrayError("invalid", `Dish ${item.itemId} doesn't exist`);
    for (const id of item.addOnIds) {
      const addOn = addOns.get(id);
      if (!addOn || addOn.item_id !== item.itemId)
        throw new TrayError("invalid", `Add-on ${id} doesn't go with dish ${item.itemId}`);
    }
  }
}

// Everything that stops this one line being ordered right now ([] if it's fine).
// Safety comes first: the same decideDish / decideAddOn as the menu, so the tray can never allow
// a dish the menu locks (an Ask Mum "yes" from today counts here too, but never for allergies).
function findLineProblems(item, lineIndex, dish, addOns, child) {
  const problem = (reason, addOn = null) => ({
    lineIndex,
    itemId: item.itemId,
    addOnId: addOn ? addOn.add_on_id : null,
    name: addOn ? addOn.name : dish.name,
    reason,
  });

  const verdict = decideDish(toDishFacts(dish), child);
  if (verdict.status === STATUS.BLOCKED_ALLERGY) return [problem(REASON.ALLERGY)];
  if (verdict.status === STATUS.BLOCKED_PARENT) return [problem(REASON.PARENT_RULE)];
  if (!dish.is_available) return [problem(REASON.SOLD_OUT)];
  if (!dish.stall_is_open) return [problem(REASON.STALL_CLOSED)];

  return item.addOnIds
    .map((id) => addOns.get(id))
    .filter((addOn) => decideAddOn({ allergenName: addOn.allergen_name }, child).locked)
    .map((addOn) => problem(REASON.ALLERGY, addOn));
}

// One priced line. unitPrice is the dish alone (what order_items.unit_price stores); each add-on
// has its own extraPrice (order_item_add_ons.extra_price); lineTotal = (dish + add-ons) x quantity.
function priceLine(item, lineIndex, dish, addOns) {
  const chosen = item.addOnIds.map((id) => addOns.get(id));
  const unitCents = toCents(dish.price) + chosen.reduce((sum, a) => sum + toCents(a.extra_price), 0);
  return {
    lineIndex,
    itemId: dish.item_id,
    stallId: dish.stall_id,
    stallName: dish.stall_name,
    name: dish.name,
    defaultImageUrl: dish.default_image_url || null,
    quantity: item.quantity,
    unitPrice: fromCents(toCents(dish.price)),
    addOns: chosen.map((a) => ({ id: a.add_on_id, name: a.name, extraPrice: fromCents(toCents(a.extra_price)) })),
    // one portion, add-ons included ("Less rice" has negative macros), for the order_items snapshot
    macros: chosen.map(macrosOf).reduce(addMacros, macrosOf(dish)),
    lineCents: unitCents * item.quantity,
    lineTotal: fromCents(unitCents * item.quantity),
  };
}

// Lines -> one group per stall, in the order the stalls first appear in the tray.
// Leroy's checkout makes one order per group (orders holds one stall each).
function groupByStall(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.stallId))
      groups.set(line.stallId, { stallId: line.stallId, stallName: line.stallName, subtotalCents: 0, lines: [] });
    const group = groups.get(line.stallId);
    group.lines.push(line);
    group.subtotalCents += line.lineCents;
  }
  return [...groups.values()].map(({ subtotalCents, ...group }) => ({ ...group, subtotal: fromCents(subtotalCents) }));
}

/**
 * priceTray(childId, items) -> {
 *   lines: [...], stalls: [{ stallId, stallName, subtotal, lines }], total,
 *   money: { canSpend, leftAfter, shortBy }, canPay
 * }
 * Throws TrayError ("invalid" | "locked" | "no_child"). Any other error (e.g. the allergy profile
 * can't load) is thrown as it is, so nothing gets priced from half the facts (fail closed).
 * Prices come ONLY from the database.
 */
async function priceTray(childId, items) {
  const itemIds = [...new Set(items.map((i) => i.itemId))];
  const [child, dishRows, addOnRows] = await Promise.all([
    loadChildContext(childId),
    Menu.getDishesForTray(itemIds),
    Menu.getAddOnsForItems(itemIds),
  ]);
  if (!child) throw new TrayError("no_child", "Child not found");

  const dishes = new Map(dishRows.map((d) => [d.item_id, d]));
  const addOns = new Map(addOnRows.map((a) => [a.add_on_id, a]));
  checkTrayShape(items, dishes, addOns);

  // Collect EVERY problem, not just the first, so the kid can fix the whole tray in one go
  const problems = items.flatMap((item, i) => findLineProblems(item, i, dishes.get(item.itemId), addOns, child));
  if (problems.length > 0) throw new TrayError("locked", "Some food in your tray can't be ordered now", problems);

  const lines = items.map((item, i) => priceLine(item, i, dishes.get(item.itemId), addOns));
  const totalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);
  const canSpendCents = toCents(child.canSpend);

  return {
    lines,
    stalls: groupByStall(lines),
    total: fromCents(totalCents),
    money: {
      canSpend: child.canSpend,
      leftAfter: fromCents(Math.max(canSpendCents - totalCents, 0)),
      shortBy: fromCents(Math.max(totalCents - canSpendCents, 0)),
    },
    // Safety rule 4: over budget is NOT an error. The quote still comes back (200) so the
    // screen can say how much too much it is, and checkout refuses to pay it.
    canPay: totalCents <= canSpendCents,
  };
}

module.exports = { priceTray, TrayError, REASON };
