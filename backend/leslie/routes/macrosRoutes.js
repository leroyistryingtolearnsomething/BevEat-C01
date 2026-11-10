// Routes: parent macros + order history (CB69-50)
const express = require("express");
const { getDay, getWeek, listOrders } = require("../controllers/macrosController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();
const parentOfKid = [requireAuth, requireRole("parent"), requireOwnChild];

router.get("/children/:childId/macros/day", ...parentOfKid, getDay);
router.get("/children/:childId/macros/week", ...parentOfKid, getWeek);
router.get("/children/:childId/orders", ...parentOfKid, listOrders);

module.exports = router;
