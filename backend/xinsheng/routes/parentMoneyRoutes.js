// Routes: weekday limits, spending report, low money alerts (parents only)
const express = require("express");
const dayLimits = require("../controllers/dayLimitController");
const spending = require("../controllers/spendingController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();
const parent = [requireAuth, requireRole("parent")];

router.get("/children/alerts", ...parent, spending.getAlerts);
router.get("/children/:childId/spending", ...parent, requireOwnChild, spending.getSpendingReport);
router.get("/children/:childId/day-limits", ...parent, requireOwnChild, dayLimits.getDayLimits);
router.put("/children/:childId/day-limits", ...parent, requireOwnChild, dayLimits.setDayLimits);

module.exports = router;
