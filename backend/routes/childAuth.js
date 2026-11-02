// PB02 child login (username + PIN)
// PIN is bcrypt hashed in users.password_hash
// POST /api/auth/child-login
// PUT  /api/children/:childId/pin  (parent sets kid's PIN)
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { requireAuth, requireRole, requireOwnChild } = require("../middleware/auth");

const router = express.Router();
const PIN_RE = /^\d{4,6}$/; // 4-6 digits
const SALT_ROUNDS = 10;

router.post("/auth/child-login", async (req, res, next) => {
  const { username, pin } = req.body || {};
  if (typeof username !== "string" || typeof pin !== "string" || !username.trim() || !pin)
    return res.status(400).json({ error: "Username and PIN are required" });

  try {
    const { rows } = await pool.query(
      `SELECT user_id, username, display_name, avatar_emoji, password_hash
         FROM users
        WHERE role = 'child' AND is_active AND LOWER(username) = LOWER($1)`,
      [username.trim()]
    );
    const child = rows[0];
    // same error for wrong username or PIN
    const ok = child && child.password_hash && (await bcrypt.compare(pin, child.password_hash));
    if (!ok) return res.status(401).json({ error: "Wrong username or PIN" });

    const token = jwt.sign({ id: child.user_id, role: "child" }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });
    res.json({
      token,
      child: {
        id: child.user_id,
        username: child.username,
        displayName: child.display_name,
        avatarEmoji: child.avatar_emoji,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put(
  "/children/:childId/pin",
  requireAuth,
  requireRole("parent"),
  requireOwnChild,
  async (req, res, next) => {
    const { pin } = req.body || {};
    if (typeof pin !== "string" || !PIN_RE.test(pin))
      return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
    try {
      const hash = await bcrypt.hash(pin, SALT_ROUNDS);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [hash, req.childId]);
      res.json({ message: "PIN updated" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
