// NETS QR wallet top-ups (parents only)
const express = require("express");
const { createTopUp, getTopUp } = require("../controllers/topUpController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();

router.post("/children/:childId/top-ups", requireAuth, requireRole("parent"), requireOwnChild, createTopUp);
router.get("/top-ups/:topUpId", requireAuth, requireRole("parent"), getTopUp);

module.exports = router;
