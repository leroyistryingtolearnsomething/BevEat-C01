// Routes: stall discovery
const express = require("express");
const { listStalls, getStall } = require("../controllers/stallController");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

// Any logged-in user (kid or parent) can browse stalls, so there's no requireRole here
router.get("/stalls", requireAuth, listStalls);
router.get("/stalls/:id", requireAuth, getStall);

module.exports = router;
