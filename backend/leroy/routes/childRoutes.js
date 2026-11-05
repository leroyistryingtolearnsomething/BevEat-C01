// Parent's kids: list, add, change allergies and daily limit
const express = require("express");
const { listChildren, addChild, setAllergies, setDailyLimit } = require("../controllers/childController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();
const parent = [requireAuth, requireRole("parent")];

router.get("/children", ...parent, listChildren);
router.post("/children", ...parent, addChild);
router.put("/children/:childId/allergies", ...parent, requireOwnChild, setAllergies);
router.put("/children/:childId/daily-limit", ...parent, requireOwnChild, setDailyLimit);

module.exports = router;
