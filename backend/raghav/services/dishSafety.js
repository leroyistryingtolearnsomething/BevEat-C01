// Dish safety: decides, for ONE child, whether a dish (and each of its add-ons) is allowed.
// Pure functions only: no database and no Express. They take plain facts and return a verdict,
// so every safety rule can be unit-tested on its own (test/dishSafety.test.js).

const STATUS = Object.freeze({
  ALLOWED: "allowed",
  BLOCKED_ALLERGY: "blocked_allergy",
  BLOCKED_PARENT: "blocked_parent",
});

// Money is compared in whole cents, so float maths (e.g. 0.1 + 0.2) can never let a dish
// slip under the budget by a fraction of a cent
const toCents = (amount) => Math.round(Number(amount) * 100);

const isOverBudget = (price, canSpend) => toCents(price) > toCents(canSpend);

/**
 * dish:  { itemId, price, allergenNames: string[], isFried?: boolean | null }
 * child: { allergies: [{ name, icon }], foodRules: [...], approvedItemIds: Set<number>, canSpend: number }
 *
 * Returns { status, overBudget, blockedAllergens?, reason?, parentRule?, askMumApproved? }
 */
function decideDish(dish, child) {
  // 1. Allergies come first. They protect the child's health, so nothing (not Mum's rules,
  //    not an Ask Mum approval) can ever turn an allergy block into "allowed".
  const matched = child.allergies.filter((a) => dish.allergenNames.includes(a.name));
  if (matched.length > 0) {
    return {
      status: STATUS.BLOCKED_ALLERGY,
      blockedAllergens: matched.map(({ name, icon }) => ({ name, icon })),
      overBudget: false,
    };
  }

  // Safety rule 2 (fail closed): a dish with no allergen rows might contain nothing, or
  // nobody has entered its allergens yet. We can't tell, so lock it for any child with allergies.
  if (dish.allergenNames.length === 0 && child.allergies.length > 0) {
    return { status: STATUS.BLOCKED_ALLERGY, reason: "unknown_allergens", blockedAllergens: [], overBudget: false };
  }

  // 2. Mum's food rules. These are the only blocks that Ask Mum can lift, and only for today.
  const rule = findParentRule(dish, child.foodRules);
  if (rule && !child.approvedItemIds.has(dish.itemId)) {
    return { status: STATUS.BLOCKED_PARENT, parentRule: rule, overBudget: false };
  }

  const verdict = { status: STATUS.ALLOWED, overBudget: isOverBudget(dish.price, child.canSpend) };
  if (rule) verdict.askMumApproved = true; // Mum said "yes, just this once"
  return verdict;
}

// The first of Mum's rules this dish breaks, or null
function findParentRule(dish, rules) {
  const broken = rules.find((rule) => {
    if (rule.type === "blocked_item") return rule.itemId === dish.itemId;
    // isFried stays unknown (undefined) until menu_items.is_fried exists (schema request #7).
    // Fail closed: if Mum said "no fried food" and we can't tell, keep the dish locked.
    if (rule.type === "no_fried") return dish.isFried !== false;
    return true; // a rule type this code doesn't know yet: lock rather than ignore it
  });
  return broken ? { type: broken.type, label: broken.label } : null;
}

/**
 * addOn: { allergenName: string | null }
 * Only called for a dish that is already allowed, so the dish's own allergens are known to be safe.
 * add_ons.allergen_id holds the one allergen the add-on brings that the dish may not already have
 * (the rule seed 03 checks), so this single comparison is enough.
 */
function decideAddOn(addOn, child) {
  const allergic = addOn.allergenName !== null && child.allergies.some((a) => a.name === addOn.allergenName);
  return allergic ? { locked: true, lockReason: "allergy" } : { locked: false };
}

// The ticks on Food detail's "Safe for you!" card, e.g. ["No shellfish", "No peanuts", "Not fried"]
function safeChecks(dish, child) {
  const checks = child.allergies.map((a) => `No ${a.name.toLowerCase()}`);
  if (dish.isFried === false) checks.push("Not fried"); // only once is_fried exists
  return checks;
}

module.exports = { STATUS, decideDish, decideAddOn, safeChecks, isOverBudget, toCents };
