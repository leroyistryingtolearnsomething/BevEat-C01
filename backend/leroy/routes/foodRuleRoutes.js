// Parent's Menu: see what a child sees, and lock dishes ("Mum says no" on the kid's menu)
const express = require("express");
const { getMenu, setLocked } = require("../controllers/foodRuleController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();
const parentOfChild = [requireAuth, requireRole("parent"), requireOwnChild];

router.get("/children/:childId/menu", ...parentOfChild, getMenu);
router.put("/children/:childId/blocked-items/:itemId", ...parentOfChild, setLocked);

module.exports = router;
