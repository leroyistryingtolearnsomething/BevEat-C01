// Everything the menu needs from TEAMMATES' features, kept in one file so each mock is easy to
// find and swap for the real function later. Shapes: docs/api-contracts.md §2.
// Other files call these as `Teammates.getFoodRules(...)` (not destructured), so a test can
// replace one function without touching the rest.
const Home = require("../../gabriel/models/homeModel"); // read-only reuse, never edited here
const Menu = require("../models/menuModel");

// Xin Sheng's allergy profile (§2a). Reuses Gabriel's existing read of child_allergies.
// If the database fails this THROWS, so the request fails closed with a 500. It never returns
// an empty list, which would wrongly mean "no allergies".
async function getChildAllergies(childId) {
  const rows = await Home.getRules(childId);
  return rows.map((r) => ({ name: r.name, icon: r.icon, severity: r.severity }));
}

// Xin Sheng's money check (§2c). Reuses Gabriel's Home queries, so the menu and Home always agree.
// Returns null if there's no child profile for this id.
async function getMoneyToday(childId) {
  const child = await Home.getChildSummary(childId);
  if (!child) return null;
  const dailyLimit = Number(child.daily_limit);
  const spentToday = Number(await Home.getSpentToday(childId));
  return {
    dailyLimit,
    spentToday,
    leftToday: Math.max(dailyLimit - spentToday, 0),
    walletBalance: Number(child.wallet_balance),
  };
}

// MOCK: replace when Leroy's getFoodRules is ready (§2b). There is no food-rules table yet,
// so no dish is "Mum says no" until it exists.
async function getFoodRules(_childId) {
  return [];
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
