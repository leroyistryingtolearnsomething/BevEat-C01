// Menu service: gathers the facts about one child, then judges dishes with dishSafety.
// Shared by the menu, food detail and Ask Mum endpoints, so all three always agree.
const Teammates = require("./teammates");
const AskMum = require("../models/askMumModel");
const { STATUS, decideDish } = require("./dishSafety");

const round2 = (n) => Math.round(n * 100) / 100;

// Everything needed to judge dishes for one child, or null if the child has no profile.
// If ANY piece fails to load, this throws and the request ends in a 500. We never build a
// menu from half the facts, e.g. dishes without the allergy list (fail closed).
async function loadChildContext(childId) {
  const money = await Teammates.getMoneyToday(childId);
  if (!money) return null;

  const [allergies, customBlocks, foodRules, approvedItemIds] = await Promise.all([
    Teammates.getChildAllergies(childId),
    Teammates.getCustomAllergyBlocks(childId),
    Teammates.getFoodRules(childId),
    AskMum.approvedItemIdsToday(childId),
  ]);

  return {
    childId,
    allergies,
    customBlocks,
    foodRules,
    approvedItemIds: new Set(approvedItemIds),
    // what the child can pay right now: today's limit left, but never more than the wallet holds
    canSpend: round2(Math.min(money.leftToday, money.walletBalance)),
  };
}

// DB row -> the facts dishSafety needs
function toDishFacts(row) {
  return {
    itemId: row.item_id,
    price: Number(row.price),
    allergenNames: row.allergen_names,
    isFried: row.is_fried, // null/undefined = unknown, which dishSafety treats as fried (fail closed)
    isLowSugar: row.is_low_sugar,
    sugarG: row.sugar_g === null || row.sugar_g === undefined ? row.sugar_g : Number(row.sugar_g),
  };
}

// DB row + verdict + top photo -> one card on the menu grid (docs/api-contracts.md §3a)
function toDishCard(row, verdict, photo) {
  return {
    id: row.item_id,
    name: row.name,
    price: Number(row.price),
    // community photo first, then the dish's default image; null lets the app show its placeholder
    imageUrl: (photo && photo.imageUrl) || row.default_image_url || null,
    hearts: photo ? photo.hearts : 0,
    badges: [], // "Healthy pick" / "Less sugar" need schema request #7, so none yet
    ...verdict,
  };
}

// Judge every dish and attach its photo. One photo query for the whole list.
async function buildDishCards(rows, child) {
  const photos = await Teammates.getTopPhotos(rows.map((r) => r.item_id), child.childId);
  return rows.map((row) => ({
    card: toDishCard(row, decideDish(toDishFacts(row), child), photos.get(row.item_id)),
    photo: photos.get(row.item_id) || null,
  }));
}

const isAllowed = (card) => card.status === STATUS.ALLOWED;

module.exports = { loadChildContext, toDishFacts, buildDishCards, isAllowed };
