// Parent sign up and log in (email + password), password is bcrypt hashed in users.password_hash
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../xinsheng/models/userModel");

const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SG_MOBILE_RE = /^\+65[89]\d{7}$/;

const loggedIn = (parent) => ({
  token: jwt.sign({ id: parent.user_id, role: "parent" }, process.env.JWT_SECRET, { expiresIn: "8h" }),
  parent: { id: parent.user_id, name: parent.display_name, email: parent.email },
});

// POST /api/auth/parent-signup  body { name, mobile: "+6581234567", email, password }
async function parentSignup(req, res, next) {
  const { name, mobile, email, password } = req.body || {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  if (!str(name) || str(name).length > 100) return res.status(400).json({ error: "Enter your name" });
  if (!SG_MOBILE_RE.test(str(mobile))) return res.status(400).json({ error: "Enter a Singapore mobile number" });
  if (!EMAIL_RE.test(str(email)) || str(email).length > 254) return res.status(400).json({ error: "Enter a valid email" });
  if (typeof password !== "string" || password.length < 8 || password.length > 72 || !/\d/.test(password))
    return res.status(400).json({ error: "Password needs 8 or more characters with a number" });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    // stored lower case so log in (case-insensitive) finds exactly one account
    const parent = await User.createParent(str(name), str(email).toLowerCase(), str(mobile), hash);
    res.status(201).json(loggedIn(parent));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email already has an account" });
    next(err);
  }
}

// POST /api/auth/parent-login
async function parentLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const parent = await User.findActiveParentByEmail(email.trim());
    // same error for wrong email or password
    const ok = parent && (await bcrypt.compare(password, parent.password_hash));
    if (!ok) return res.status(401).json({ error: "Wrong email or password" });
    res.json(loggedIn(parent));
  } catch (err) {
    next(err);
  }
}

module.exports = { parentSignup, parentLogin };
