// Routes: a parent's own allergy words for one of their kids (migration 005)
const express = require("express");
const { list, add, remove } = require("../controllers/customAllergyController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();
const parentOfKid = [requireAuth, requireRole("parent"), requireOwnChild];

router.get("/children/:childId/custom-allergies", ...parentOfKid, list);
router.post("/children/:childId/custom-allergies", ...parentOfKid, add);
router.delete("/children/:childId/custom-allergies/:customAllergyId", ...parentOfKid, remove);

module.exports = router;
