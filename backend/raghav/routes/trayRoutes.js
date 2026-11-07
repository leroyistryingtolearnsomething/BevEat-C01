// Routes: My tray (kids only). Leroy's POST /api/checkout reuses services/trayPricing.js.
const express = require("express");
const { quoteTray } = require("../controllers/trayController");
const { requireAuth, requireRole } = require("../../middleware/auth");

const router = express.Router();

// The tray is checked against the logged-in child's allergies and money, so only children use it
router.post("/tray/quote", requireAuth, requireRole("child"), quoteTray);

module.exports = router;
