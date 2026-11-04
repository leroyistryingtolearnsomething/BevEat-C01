// Routes: child login (PB02)
const express = require("express");
const { childLogin, setChildPin } = require("../controllers/childAuthController");
const { requireAuth, requireRole, requireOwnChild } = require("../../middleware/auth");

const router = express.Router();

router.post("/auth/child-login", childLogin);
router.put("/children/:childId/pin", requireAuth, requireRole("parent"), requireOwnChild, setChildPin);

module.exports = router;
