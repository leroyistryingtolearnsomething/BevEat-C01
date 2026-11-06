// Routes: stall menu + food detail (kids only), and Ask Mum
const express = require("express");
const { getStallMenu, getDishDetail } = require("../controllers/menuController");
const { askMum, getAskMum } = require("../controllers/askMumController");
const { requireAuth, requireRole } = require("../../middleware/auth");

const router = express.Router();
// Each dish's status is worked out for the logged-in child, so only children can use these.
// (Parents preview "what my child sees" through their own screens.)
const child = [requireAuth, requireRole("child")];

router.get("/stalls/:stallId/menu", ...child, getStallMenu);
router.get("/menu-items/:itemId", ...child, getDishDetail);
router.post("/ask-mum", ...child, askMum);
router.get("/ask-mum/:itemId", ...child, getAskMum);

module.exports = router;
