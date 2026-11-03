// PB02 child login (username + PIN)
// PIN is bcrypt hashed in users.password_hash
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const PIN_RE = /^\d{4,6}$/; // 4-6 digits
const SALT_ROUNDS = 10;

// POST /api/auth/child-login
async function childLogin(req, res, next) {
  const { username, pin } = req.body || {};
  if (typeof username !== "string" || typeof pin !== "string" || !username.trim() || !pin)
    return res.status(400).json({ error: "Username and PIN are required" });

  try {
    const child = await User.findActiveChildByUsername(username.trim());
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
}

// PUT /api/children/:childId/pin  (parent sets kid's PIN; req.childId comes from requireOwnChild)
async function setChildPin(req, res, next) {
  const { pin } = req.body || {};
  if (typeof pin !== "string" || !PIN_RE.test(pin))
    return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
  try {
    const hash = await bcrypt.hash(pin, SALT_ROUNDS);
    await User.updatePasswordHash(req.childId, hash);
    res.json({ message: "PIN updated" });
  } catch (err) {
    next(err);
  }
}

module.exports = { childLogin, setChildPin };
