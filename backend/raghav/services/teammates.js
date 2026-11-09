// Everything the menu needs from TEAMMATES' features, kept in one file so each mock is easy to
// find and swap for the real function later. Shapes: docs/api-contracts.md §2.
// Other files call these as `Teammates.getFoodRules(...)` (not destructured), so a test can
// replace one function without touching the rest.
const Home = require("../../gabriel/models/homeModel"); // read-only reuse, never edited here
const Money = require("../../xinsheng/services/moneyService"); // read-only reuse, never edited here
const Menu = require("../models/menuModel");
const FoodRule = require("../../leroy/models/foodRuleModel"); // read-only reuse, never edited here

// Xin Sheng's allergy profile (§2a). Reuses Gabriel's existing read of child_allergies.
// If the database fails this THROWS, so the request fails closed with a 500. It never returns
// an empty list, which would wrongly mean "no allergies".
async function getChildAllergies(childId) {
  const rows = await Home.getRules(childId);
  return rows.map((r) => ({ name: r.name, icon: r.icon, severity: r.severity }));
}

// Xin Sheng's money check (§2c): today's limit (including a different limit for this weekday),
// minus what was spent today, plus the wallet balance. Using her function means the menu, the
// tray and her parent screens always agree on the money. Returns null if there's no child profile.
const getMoneyToday = (childId) => Money.getMoneyToday(childId);

// Leroy's parent food rules (§2b): the dishes this child's parent locked on the parent Menu screen.
// Like allergies, a database failure THROWS, so the request fails closed instead of showing
// a locked dish.
async function getFoodRules(childId) {
  const rows = await FoodRule.listRulesForChild(childId);
  return rows.map((r) => ({
    type: r.rule_type,
    itemId: r.item_id ?? undefined,
    label: r.name ?? undefined, // "Mum picked “Fishball soup”."
  }));
}

// MOCK: replace when Gabriel's getTopPhotos is ready (§2d). Returns Map itemId -> photo.
async function getTopPhotos(itemIds, viewerId) {
  if (itemIds.length === 0) return new Map();
  const rows = await Menu.getTopPhotos(itemIds, viewerId);
  return new Map(
    rows.map((p) => [
      p.item_id,
      {
        photoId: p.photo_id,
        imageUrl: p.image_url,
        hearts: p.hearts,
        likedByMe: p.liked_by_me,
        uploaderUsername: p.username,
        totalPics: p.total_pics,
      },
    ])
  );
}

module.exports = { getChildAllergies, getMoneyToday, getFoodRules, getTopPhotos };
