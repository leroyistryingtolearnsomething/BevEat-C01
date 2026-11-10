// Routes: pay for the tray from the wallet (kids only)
const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const { requireAuth, requireRole } = require("../../middleware/auth");

const router = express.Router();

router.post("/checkout", requireAuth, requireRole("child"), checkout);

module.exports = router;
