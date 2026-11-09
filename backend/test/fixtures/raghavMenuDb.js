// Fake in-memory database for Raghav's menu + Ask Mum tests (no Supabase connection needed).
// The dishes and their allergen tags are copied from the live database on 2026-11-06, so the
// allergy tests run against the real menu. Call install() BEFORE requiring ../../server.

const allergens = {
  1: { name: "Peanuts", icon: "🥜" }, 2: { name: "Tree nuts", icon: "🌰" }, 3: { name: "Milk", icon: "🥛" },
  4: { name: "Egg", icon: "🥚" }, 5: { name: "Shellfish", icon: "🦐" }, 6: { name: "Fish", icon: "🐟" },
  7: { name: "Soy", icon: "🫘" }, 8: { name: "Wheat / gluten", icon: "🌾" }, 9: { name: "Sesame", icon: "⚪" },
};

const stalls = [
  { stall_id: 1, name: "Lim's Chicken Rice", unit_no: "#01-05", cuisine: "Chinese", is_halal: false, description: "Chicken rice", year_started: 1988, is_open: true, avg_prep_minutes: 4, cover_image_url: null },
  { stall_id: 2, name: "Mariam Nasi Lemak", unit_no: "#01-08", cuisine: "Malay", is_halal: true, description: "Nasi lemak", year_started: 2002, is_open: true, avg_prep_minutes: 5, cover_image_url: null },
  { stall_id: 3, name: "Kumar's Prata Corner", unit_no: "#01-12", cuisine: "Indian", is_halal: true, description: "Prata", year_started: 1995, is_open: true, avg_prep_minutes: 6, cover_image_url: null },
  { stall_id: 4, name: "Wong's Drinks & Desserts", unit_no: "#01-15", cuisine: "Drinks", is_halal: false, description: "Drinks", year_started: 1983, is_open: true, avg_prep_minutes: 3, cover_image_url: null },
  { stall_id: 5, name: "Hakim's Western Grill", unit_no: "#01-18", cuisine: "Western", is_halal: true, description: "Western", year_started: 2009, is_open: true, avg_prep_minutes: 7, cover_image_url: null },
];

// [item_id, stall_id, name, price, allergen ids] (live data). 11 and 12 have NO allergen rows.
const dishRows = [
  [1, 1, "Steamed Chicken Rice", "3.50", [7, 8, 9]], [2, 1, "Roasted Chicken Rice", "3.80", [7, 8, 9]],
  [3, 1, "Kids Chicken Rice Set", "2.80", [7, 8, 9]], [13, 1, "Char Siew Rice", "3.80", [7, 8, 9]],
  [14, 1, "Dry Wanton Noodles", "3.50", [4, 5, 7, 8, 9]], [15, 1, "Fishball Noodle Soup", "3.50", [4, 6, 7, 8]],
  [4, 2, "Nasi Lemak with Chicken Wing", "4.00", [1, 4, 5, 6, 8]], [5, 2, "Mee Goreng", "3.50", [4, 5, 7, 8]],
  [6, 2, "Plain Nasi Lemak (no sambal)", "2.50", [4]], [16, 2, "Mee Soto", "3.50", [4, 7, 8]],
  [17, 2, "Kids Ayam Goreng Set", "3.20", [4, 8]], [18, 2, "Mee Rebus", "3.50", [1, 4, 5, 7, 8]],
  [7, 3, "Plain Prata with Dhal (2 pcs)", "2.20", [3, 8]], [8, 3, "Egg Prata with Dhal (2 pcs)", "3.00", [3, 4, 8]],
  [9, 3, "Cheese Prata with Dhal (2 pcs)", "3.50", [3, 8]], [19, 3, "Chicken Briyani", "5.00", [2, 3]],
  [20, 3, "Plain Thosai with Dhal", "2.00", [3]], [21, 3, "Roti John", "4.50", [3, 4, 7, 8]],
  [10, 4, "Milo Ice", "1.80", [3, 7, 8]], [11, 4, "Chendol", "2.50", []], [12, 4, "Fresh Watermelon Juice", "2.00", []],
  [22, 4, "Soya Bean Milk", "1.50", [7]], [23, 4, "Barley Water", "1.50", [8]], [24, 4, "Ice Kacang", "3.00", [1, 3]],
  [25, 5, "Chicken Chop with Fries", "5.50", [3, 4, 8]], [26, 5, "Fish & Chips", "5.50", [4, 6, 8]],
  [27, 5, "Spaghetti Bolognese", "5.00", [3, 8]], [28, 5, "Chicken Nuggets & Fries", "4.50", [4, 7, 8]],
  [29, 5, "Grilled Chicken with Mashed Potato", "5.80", [3, 7, 8]], [30, 5, "Mac & Cheese", "4.50", [3, 8]],
  [31, 1, "Sold-out Special", "3.00", [7]], // not on the live menu: tests is_available = false
];
const dishes = dishRows.map(([item_id, stall_id, name, price, ids]) => ({
  item_id, stall_id, name, price, allergenIds: ids, description: `${name} description`,
  default_image_url: `/images/menu/dish-${item_id}.jpg`, is_available: item_id !== 31,
}));

// A few add-ons (live data, incl. ones with and without an allergen)
const addOns = [
  { add_on_id: 1, item_id: 1, name: "Extra chicken", extra_price: "1.50", allergen_id: null, calories: 120 },
  { add_on_id: 2, item_id: 1, name: "Less rice", extra_price: "0.00", allergen_id: null },
  { add_on_id: 3, item_id: 1, name: "Add braised egg", extra_price: "0.80", allergen_id: 4 },
  { add_on_id: 5, item_id: 4, name: "Add otah", extra_price: "1.00", allergen_id: 6 },
  { add_on_id: 8, item_id: 10, name: "Less sweet", extra_price: "0.00", allergen_id: null },
  { add_on_id: 11, item_id: 19, name: "Add hard-boiled egg", extra_price: "0.80", allergen_id: 4 },
  { add_on_id: 12, item_id: 24, name: "Add vanilla ice cream", extra_price: "1.00", allergen_id: 4 },
];

// Children: { allergies: [allergenId, severity][], limit, wallet, spent, dayLimits? }
// dayLimits = rows of Xin Sheng's child_day_limits: [weekday, limit]
const children = {
  3: { name: "Ethan", allergies: [[1, "severe"], [5, "avoid"]], limit: "5.00", wallet: "11.90", spent: "0" },
  4: { name: "Chloe", allergies: [[4, "avoid"]], limit: "4.00", wallet: "7.50", spent: "0" },
  5: { name: "Aisyah", allergies: [], limit: "6.00", wallet: "21.00", spent: "0" },
  6: { name: "Low wallet", allergies: [], limit: "5.00", wallet: "2.00", spent: "0" },
  7: { name: "Spent most", allergies: [], limit: "5.00", wallet: "20.00", spent: "3.20" },
  // S$2.00 on EVERY weekday, so the test doesn't depend on which day it runs
  8: { name: "Short days", allergies: [], limit: "5.00", wallet: "20.00", spent: "0",
       dayLimits: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "2.00"]) },
};
// Custom allergies (words a parent typed, migration 005). Child 20 has ONLY custom ones.
children[20] = { name: "Custom only", allergies: [], custom: ["Watermelon", "Ice cream"], limit: "50.00", wallet: "50.00", spent: "0" };


// Same rule as mentions_food() in migration 005: word start, ignore case, simple plurals,
// and "no X" / "without X" doesn't count
function mentionsFood(text, word) {
  let w = word.trim().toLowerCase();
  const stem = w.replace(/(ies|y|es|s)$/, "");
  if (stem.length >= 3) w = stem;
  return new RegExp("(?<!no )(?<!without )(?<![a-z0-9])" + w.replace(/[^a-z0-9]/g, "\\$&"), "i").test(text);
}
const customOf = (childId) => (children[childId] && children[childId].custom) || [];

// One child per allergen: child 101 is allergic to allergen 1 (Peanuts) ... child 109 to Sesame
for (let id = 1; id <= 9; id++) {
  children[100 + id] = { name: `Allergic to ${allergens[id].name}`, allergies: [[id, "avoid"]], limit: "50.00", wallet: "50.00", spent: "0" };
}

// Photos for Roasted Chicken Rice (item 2): photo 3 has the most votes but is still waiting for
// a parent's approval, so it must NOT be the top photo. Photo 4 failed the AI check.
const users = { 50: "kai_snaps", 51: "mei_eats" };
const photos = [
  { photo_id: 1, item_id: 2, uploaded_by: 50, image_url: "/uploads/photos/p1.jpg", ai_status: "passed", approval_status: "approved", uploaded_at: 1 },
  { photo_id: 2, item_id: 2, uploaded_by: 51, image_url: "/uploads/photos/p2.jpg", ai_status: "passed", approval_status: "not_needed", uploaded_at: 2 },
  { photo_id: 3, item_id: 2, uploaded_by: 51, image_url: "/uploads/photos/p3.jpg", ai_status: "passed", approval_status: "pending", uploaded_at: 3 },
  { photo_id: 4, item_id: 1, uploaded_by: 50, image_url: "/uploads/photos/p4.jpg", ai_status: "failed", approval_status: "pending", uploaded_at: 4 },
];
const votes = [[1, 3], [1, 4], [1, 5], [2, 4], [3, 3], [3, 4], [3, 5], [3, 6], [4, 3]]; // [photo_id, user_id]

const state = { queries: [], failAllergies: false };

const allergenNames = (ids) => [...ids].sort((a, b) => a - b).map((id) => allergens[id].name);

function dishRow(d) {
  return {
    item_id: d.item_id, stall_id: d.stall_id, name: d.name, description: d.description, price: d.price,
    default_image_url: d.default_image_url, allergen_names: allergenNames(d.allergenIds),
  };
}

function topPhotos(itemIds, viewerId) {
  const ok = photos.filter((p) => itemIds.includes(p.item_id) && p.ai_status === "passed" &&
    ["approved", "not_needed"].includes(p.approval_status));
  const withVotes = ok.map((p) => {
    const voters = votes.filter(([pid]) => pid === p.photo_id).map(([, uid]) => uid);
    return { ...p, hearts: voters.length, liked_by_me: voters.includes(viewerId) };
  });
  return itemIds.flatMap((itemId) => {
    const mine = withVotes.filter((p) => p.item_id === itemId)
      .sort((a, b) => b.hearts - a.hearts || b.uploaded_at - a.uploaded_at);
    if (!mine.length) return [];
    const top = mine[0];
    return [{ item_id: itemId, photo_id: top.photo_id, image_url: top.image_url, username: users[top.uploaded_by],
      hearts: top.hearts, liked_by_me: top.liked_by_me, total_pics: mine.length }];
  });
}

function fakeQuery(sql, params = []) {
  state.queries.push({ sql, params });
  const [p1, p2] = params;

  // Gabriel's homeModel (reused read-only by Raghav's teammates.js)
  if (sql.includes("FROM users u") && sql.includes("JOIN child_profiles c")) {
    const c = children[p1];
    return { rows: c ? [{ display_name: c.name, avatar_emoji: "🙂", wallet_balance: c.wallet, daily_limit: c.limit }] : [] };
  }
  if (sql.includes("SUM(total_amount)")) return { rows: [{ spent: children[p1] ? children[p1].spent : "0" }] };

  // Xin Sheng's dayLimitModel (moneyService reads it for weekday limits)
  if (sql.includes("FROM child_day_limits WHERE child_id = $1")) {
    const c = children[p1];
    return { rows: (c && c.dayLimits ? c.dayLimits : []).map(([weekday, daily_limit]) => ({ weekday, daily_limit })) };
  }
  if (sql.includes("FROM child_allergies ca")) {
    if (state.failAllergies) throw new Error("allergy table unreachable (expected in this test)");
    const c = children[p1];
    const preset = (c ? c.allergies : []).map(([id, severity]) => ({ ...allergens[id], severity }));
    const custom = sql.includes("child_custom_allergies") ? customOf(p1).map((label) => ({ name: label, icon: "⚠️", severity: "avoid" })) : [];
    return { rows: [...preset, ...custom] };
  }
  if (sql.includes("FROM v_child_custom_allergy_items")) {
    return { rows: customOf(p1).flatMap((label) => dishes
      .filter((d) => mentionsFood(`${d.name} ${d.description}`, label))
      .map((d) => ({ item_id: d.item_id, label, icon: "⚠️" }))) };
  }
  if (sql.includes("FROM v_child_custom_allergy_add_ons")) {
    return { rows: customOf(p1).flatMap((label) => addOns
      .filter((a) => mentionsFood(a.name, label))
      .map((a) => ({ add_on_id: a.add_on_id, label, icon: "⚠️" }))) };
  }

  // Raghav's stallModel
  if (sql.includes("FROM stalls WHERE stall_id = $1")) return { rows: stalls.filter((s) => s.stall_id === p1) };

  // Raghav's menuModel
  if (sql.includes("FROM photos p")) return { rows: topPhotos(p1, p2) };

  // tray: dishes by id INCLUDING sold-out ones, with their stall's open flag and macros
  if (sql.includes("AS stall_is_open")) {
    return {
      rows: dishes.filter((d) => p1.includes(d.item_id)).map((d) => {
        const stall = stalls.find((s) => s.stall_id === d.stall_id);
        return { ...dishRow(d), is_available: d.is_available, stall_name: stall.name, stall_is_open: stall.is_open,
          calories: 400, protein_g: "20.0", carbs_g: "50.0", fat_g: "10.0" };
      }),
    };
  }
  // tray: every add-on of the dishes in the tray (must come before the single-dish add-on query)
  if (sql.includes("WHERE ao.item_id = ANY")) {
    return {
      rows: addOns.filter((a) => p1.includes(a.item_id)).map((a) => ({
        add_on_id: a.add_on_id, item_id: a.item_id, name: a.name, extra_price: a.extra_price,
        allergen_name: a.allergen_id ? allergens[a.allergen_id].name : null,
        calories: a.calories || 0, protein_g: "0", carbs_g: "0", fat_g: "0",
      })),
    };
  }
  if (sql.includes("FROM add_ons ao")) {
    return {
      rows: addOns.filter((a) => a.item_id === p1).map((a) => ({
        add_on_id: a.add_on_id, name: a.name, extra_price: a.extra_price,
        allergen_name: a.allergen_id ? allergens[a.allergen_id].name : null,
        allergen_icon: a.allergen_id ? allergens[a.allergen_id].icon : null,
      })),
    };
  }
  if (sql.includes("WHERE m.stall_id = $1")) {
    return { rows: dishes.filter((d) => d.stall_id === p1 && d.is_available).map(dishRow) };
  }
  if (sql.includes("WHERE m.item_id = $1")) {
    const d = dishes.find((x) => x.item_id === p1 && x.is_available);
    return { rows: d ? [{ ...dishRow(d), stall_name: stalls.find((s) => s.stall_id === d.stall_id).name }] : [] };
  }

  // Leroy's parent locks (child_food_rules): none here. Tests that need a "Mum says no" dish
  // replace Teammates.getFoodRules instead.
  if (sql.includes("FROM child_food_rules")) return { rows: [] };

  throw new Error("Fake DB got an unexpected query: " + sql.slice(0, 80));
}

const fakePool = {
  query: async (sql, params) => fakeQuery(sql, params),
  connect: async () => ({ query: async (sql, params) => fakeQuery(sql, params), release() {} }),
};

// Swap the real db.js for this fake before the app (and every model) loads
function install() {
  const dbPath = require.resolve("../../config/db");
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };
}

// Which allergen names a dish really contains (for checking the API's answers)
const dishAllergenNames = (itemId) => allergenNames(dishes.find((d) => d.item_id === itemId).allergenIds);

module.exports = { install, state, allergens, dishes, children, stalls, dishAllergenNames, mentionsFood };
