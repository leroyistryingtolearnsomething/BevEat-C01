// Parent's Menu screen: see what a child sees, and lock dishes so the child's menu shows "Mum says no"
const FoodRule = require("../models/foodRuleModel");
const ChildAccount = require("../models/childAccountModel");

// GET /api/children/:childId/menu  (req.childId comes from requireOwnChild)
// allergyBlocked = the child can never see it; locked = this parent locked it
async function getMenu(req, res, next) {
  try {
    const [rows, allergies] = await Promise.all([
      FoodRule.listMenuForChild(req.childId),
      ChildAccount.getAllergyNames(req.childId),
    ]);
    res.json({
      dishes: rows.map((d) => ({
        id: d.item_id,
        name: d.name,
        price: Number(d.price),
        imageUrl: d.default_image_url,
        stallName: d.stall_name,
        // same fail-closed rule as the kid's menu: no allergen info + a child with allergies = blocked
        allergyBlocked:
          d.allergen_names.some((n) => allergies.includes(n)) || (d.allergen_names.length === 0 && allergies.length > 0),
        locked: d.locked,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/children/:childId/blocked-items/:itemId  body { locked: true | false }
async function setLocked(req, res, next) {
  const itemId = Number(req.params.itemId);
  const { locked } = req.body || {};
  if (!Number.isInteger(itemId) || itemId <= 0) return res.status(400).json({ error: "Invalid dish id" });
  if (typeof locked !== "boolean") return res.status(400).json({ error: "locked must be true or false" });

  try {
    if (locked) {
      if (!(await FoodRule.lockItem(req.childId, itemId))) return res.status(404).json({ error: "Dish not found" });
    } else {
      await FoodRule.unlockItem(req.childId, itemId);
    }
    res.json({ itemId, locked });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMenu, setLocked };
