// Routes: parent side of Ask Mum (CB69-26) and Mum's rules switches (CB69-18)
const express = require("express");
const AskMum = require("../controllers/askMumParentController");
const FoodRules = require("../controllers/foodRuleSettingsController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();
const parent = [requireAuth, requireRole("parent")];
const parentOfKid = [...parent, requireOwnChild];

// The two GETs come before Raghav's kid-only GET /ask-mum/:itemId in server.js, so "pending" and
// "requests" are never read as a dish id
router.get("/ask-mum/pending", ...parent, AskMum.listPending);
router.get("/ask-mum/requests/:requestId", ...parent, AskMum.getOne);
router.put("/ask-mum/:requestId", ...parent, AskMum.decide);
router.get("/children/:childId/ask-mum", ...parentOfKid, AskMum.listForChild);

router.get("/children/:childId/food-rules", ...parentOfKid, FoodRules.get);
router.put("/children/:childId/food-rules", ...parentOfKid, FoodRules.update);

module.exports = router;
