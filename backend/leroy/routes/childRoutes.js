// Parent adds a kid
const express = require("express");
const { addChild } = require("../controllers/childController");
const { requireAuth, requireRole } = require("../../middleware/auth");

const router = express.Router();

router.post("/children", requireAuth, requireRole("parent"), addChild);

module.exports = router;
