// Parent sign up and log in
const express = require("express");
const { parentSignup, parentLogin } = require("../controllers/parentAuthController");

const router = express.Router();

router.post("/auth/parent-signup", parentSignup);
router.post("/auth/parent-login", parentLogin);

module.exports = router;
