// PB02 child login (username + PIN)
// PIN is bcrypt hashed in users.password_hash
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const PIN_RE = /^\d{4,6}$/; // 4-6 digits
const SALT_ROUNDS = 10;
// 5 wrong PINs locks the kid for 15 min, or until the parent sets a new PIN
const MAX_PIN_TRIES = 5;
const LOCK_MINUTES = 15;
const LOCKED_MSG = "Too many wrong PINs. Ask your parent to reset it, or try again in 15 minutes";

// POST /api/auth/child-login
async function childLogin(req, res, next) {
  const { username, pin } = req.body || {};
  if (typeof username !== "string" || typeof pin !== "string" || !username.trim() || !pin)
    return res.status(400).json({ error: "Username and PIN are required" });

  try {
    // lockSeconds = how long until they can try again (for the countdown)
    const locked = (seconds) => res.status(423).json({ error: LOCKED_MSG, lockSeconds: seconds });

    const child = await User.findActiveChildByUsername(username.trim());
    if (child && child.locked) return locked(child.lock_seconds);

    // unknown nickname gets its own message, wrong PIN shows tries left
    const ok = child && child.password_hash && (await bcrypt.compare(pin, child.password_hash));
    if (!ok) {
      if (child) {
        const row = await User.recordWrongPin(child.user_id, MAX_PIN_TRIES, LOCK_MINUTES);
        if (row && row.locked) return locked(row.lock_seconds);
        if (row) return res.status(401).json({ error: "Wrong username or PIN", attemptsLeft: MAX_PIN_TRIES - row.failed_pin_tries });
      }
      if (!child) return res.status(404).json({ error: "No account with that nickname" });
      return res.status(401).json({ error: "Wrong username or PIN" });
    }
    if (child.failed_pin_tries > 0) await User.clearPinTries(child.user_id);

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

// PUT /api/children/:childId/pin  (parent sets / resets kid's PIN, also unlocks; req.childId comes from requireOwnChild)
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
