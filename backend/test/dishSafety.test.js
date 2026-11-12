// Dish safety rules (Raghav). Pure unit tests: no database, no server.
// Run with: npm test   (or just this file: node test/dishSafety.test.js)

const { STATUS, decideDish, decideAddOn, safeChecks, isOverBudget } = require("../raghav/services/dishSafety");
const { allergens, dishes, dishAllergenNames } = require("./fixtures/raghavMenuDb");

let failed = 0;
function check(passed, name) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed++;
}

const ALL_ALLERGENS = Object.values(allergens);
const allergy = (name) => ({ name, icon: ALL_ALLERGENS.find((a) => a.name === name).icon });

function makeChild({ allergies = [], foodRules = [], approved = [], canSpend = 50 } = {}) {
  return { allergies: allergies.map(allergy), foodRules, approvedItemIds: new Set(approved), canSpend };
}
const dish = (itemId, price, allergenNames, extra = {}) => ({ itemId, price, allergenNames, ...extra });
const facts = (d) => dish(d.item_id, Number(d.price), dishAllergenNames(d.item_id));

// ---------- Safety rule 3: a child allergic to X is never allowed a dish containing X ----------

for (const { name } of ALL_ALLERGENS) {
  const child = makeChild({ allergies: [name] });
  const containing = dishes.filter((d) => dishAllergenNames(d.item_id).includes(name));
  const allowedContaining = containing.filter((d) => decideDish(facts(d), child).status === STATUS.ALLOWED);
  check(containing.length > 0 && allowedContaining.length === 0,
    `allergic to ${name}: 0 of the ${containing.length} dishes containing it are allowed`);
  check(containing.every((d) => decideDish(facts(d), child).blockedAllergens.some((a) => a.name === name)),
    `allergic to ${name}: every blocked dish names ${name} as the reason`);
}

// ---------- fail closed: no allergen data ----------

let v = decideDish(dish(11, 2.5, []), makeChild({ allergies: ["Peanuts"] }));
check(v.status === STATUS.BLOCKED_ALLERGY && v.reason === "unknown_allergens",
  "dish with no allergen data is locked for a child with any allergy");
v = decideDish(dish(11, 2.5, []), makeChild());
check(v.status === STATUS.ALLOWED, "dish with no allergen data is allowed for a child with no allergies");

v = decideDish(dish(18, 3.5, ["Peanuts", "Egg", "Shellfish"]), makeChild({ allergies: ["Shellfish", "Peanuts"] }));
check(v.blockedAllergens.map((a) => a.name).sort().join() === "Peanuts,Shellfish",
  "every matching allergen is listed, with its icon");
check(v.blockedAllergens.every((a) => a.icon), "blocked allergens carry their icon");

// ---------- Mum's rules + Ask Mum ----------

const noMilo = [{ type: "blocked_item", itemId: 10, label: "No Milo on school days" }];
v = decideDish(dish(10, 1.8, ["Milk"]), makeChild({ foodRules: noMilo }));
check(v.status === STATUS.BLOCKED_PARENT && v.parentRule.label === "No Milo on school days", "blocked item gives blocked_parent + the rule");
check(decideDish(dish(22, 1.5, ["Soy"]), makeChild({ foodRules: noMilo })).status === STATUS.ALLOWED,
  "a blocked-item rule only locks that dish");

v = decideDish(dish(10, 1.8, ["Milk"]), makeChild({ foodRules: noMilo, approved: [10] }));
check(v.status === STATUS.ALLOWED && v.askMumApproved === true, "Mum's approval today unlocks a parent-rule dish");

v = decideDish(dish(10, 1.8, ["Milk"]), makeChild({ allergies: ["Milk"], foodRules: noMilo, approved: [10] }));
check(v.status === STATUS.BLOCKED_ALLERGY, "an allergy is checked before Mum's rules, and Ask Mum can never unlock it");

const noFried = [{ type: "no_fried", label: "No fried food" }];
check(decideDish(dish(4, 4, ["Egg"]), makeChild({ foodRules: noFried })).status === STATUS.BLOCKED_PARENT,
  "no_fried locks a dish whose fried status is unknown (fail closed)");
check(decideDish(dish(4, 4, ["Egg"], { isFried: null }), makeChild({ foodRules: noFried })).status === STATUS.BLOCKED_PARENT,
  "no_fried locks a dish whose is_fried is NULL (fail closed)");
check(decideDish(dish(4, 4, ["Egg"], { isFried: true }), makeChild({ foodRules: noFried })).status === STATUS.BLOCKED_PARENT,
  "no_fried locks a fried dish");
check(decideDish(dish(1, 3.5, ["Soy"], { isFried: false }), makeChild({ foodRules: noFried })).status === STATUS.ALLOWED,
  "no_fried allows a dish that is known not to be fried");
check(decideDish(dish(1, 3.5, ["Soy"]), makeChild({ foodRules: [{ type: "something_new", label: "?" }] })).status === STATUS.BLOCKED_PARENT,
  "an unknown rule type locks rather than being ignored");

// ---------- budget ----------

check(decideDish(dish(11, 2.5, []), makeChild({ canSpend: 2 })).overBudget === true, "dish above what the child can spend is overBudget");
check(decideDish(dish(12, 2, []), makeChild({ canSpend: 2 })).overBudget === false, "dish exactly equal to what's left is not overBudget");
check(isOverBudget(0.3, 0.1 + 0.2) === false, "money is compared in cents, so 0.1 + 0.2 still covers 0.30");
check(decideDish(dish(18, 9, ["Peanuts"]), makeChild({ allergies: ["Peanuts"], canSpend: 1 })).overBudget === false,
  "a locked dish is never also reported as overBudget");

// ---------- add-ons ----------

const chloe = makeChild({ allergies: ["Egg"] });
check(decideAddOn({ allergenName: "Egg" }, chloe).locked === true, "add-on with the child's allergen is locked");
check(decideAddOn({ allergenName: "Egg" }, chloe).lockReason === "allergy", "locked add-on says why");
check(decideAddOn({ allergenName: "Milk" }, chloe).locked === false, "add-on with a different allergen is not locked");
check(decideAddOn({ allergenName: null }, chloe).locked === false, "add-on with no allergen is not locked");

// ---------- "Safe for you!" ticks ----------

const ethan = makeChild({ allergies: ["Shellfish", "Peanuts"] });
check(safeChecks(dish(2, 3.8, ["Soy"]), ethan).join() === "No shellfish,No peanuts", "safe checks list each of the child's allergies");
check(safeChecks(dish(2, 3.8, ["Soy"], { isFried: false }), ethan).includes("Not fried"), "'Not fried' shows only when known");
check(!safeChecks(dish(2, 3.8, ["Soy"]), ethan).includes("Not fried"), "'Not fried' is hidden while fried status is unknown");

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exitCode = failed ? 1 : 0;
