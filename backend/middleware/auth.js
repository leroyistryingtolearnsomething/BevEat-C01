// JWT auth. Header: Authorization: Bearer <token>, payload { id, role }
const jwt = require("jsonwebtoken");
const pool = require("../db");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) =>
    req.user && req.user.role === role
      ? next()
      : res.status(403).json({ error: `Only a ${role} can do this` });
}

// parent can only access their own children (404 otherwise)
async function requireOwnChild(req, res, next) {
  const childId = Number(req.params.childId);
  if (!Number.isInteger(childId) || childId <= 0)
    return res.status(400).json({ error: "Invalid child id" });
  try {
    const { rows } = await pool.query(
      `SELECT child_id FROM child_profiles WHERE child_id = $1 AND parent_id = $2`,
      [childId, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Child not found" });
    req.childId = childId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireRole, requireOwnChild };
